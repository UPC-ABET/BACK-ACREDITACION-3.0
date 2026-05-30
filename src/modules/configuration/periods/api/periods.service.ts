import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { CreatePeriodDto, PeriodResponse, PERIOD_MODALITY_CODES, PERIOD_STATUS_ACTIVE, PERIOD_STATUS_INACTIVE } from '../model/periods.dtos';

const MODALITY_TYPE_GROUP_CODE = 'MODALITY_TYPE';

@Injectable()
export class PeriodsService {
	constructor(private readonly dataSource: DataSource) {}

	// Crea un período académico. Estado inicial = ACT (réplica del default Estado = 'ACT' del legacy).
	// Reglas: code único, end_date ≥ start_date, modalidad existe en core.types/MODALITY_TYPE.
	async createPeriod(dto: CreatePeriodDto): Promise<PeriodResponse> {
		this.assertDateRange(dto.start_date, dto.end_date);
		this.assertModalitySupported(dto.modality_code);

		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();
		try {
			await this.assertCodeUnique(queryRunner.manager, dto.code);
			const modalityTypeId = await this.resolveModalityTypeId(queryRunner.manager, dto.modality_code);

			const inserted: Array<PeriodResponse> = await queryRunner.manager.query(
				`INSERT INTO academic.academic_periods
				 (code, start_date, end_date, modality_type_id, status, extra, is_active, created_at, updated_at)
				 VALUES ($1, $2, $3, $4, $5, '{}'::jsonb, true, NOW(), NOW())
				 RETURNING id, code, start_date::text, end_date::text, modality_type_id, status`,
				[dto.code, dto.start_date, dto.end_date, modalityTypeId, PERIOD_STATUS_ACTIVE],
			);

			await queryRunner.commitTransaction();
			return inserted[0];
		} catch (err) {
			await queryRunner.rollbackTransaction();
			throw err;
		} finally {
			await queryRunner.release();
		}
	}

	async listPeriods(): Promise<PeriodResponse[]> {
		return await this.dataSource.query(
			`SELECT id, code, start_date::text, end_date::text, modality_type_id, status
			 FROM academic.academic_periods
			 WHERE is_active = true
			 ORDER BY code DESC`,
		);
	}

	async findPeriod(id: number): Promise<PeriodResponse> {
		const rows: Array<PeriodResponse> = await this.dataSource.query(
			`SELECT id, code, start_date::text, end_date::text, modality_type_id, status
			 FROM academic.academic_periods
			 WHERE id = $1`,
			[id],
		);
		if (rows.length === 0) throw new HttpException({ message: 'Período no encontrado', errors: [`period_id=${id}`] }, HttpStatus.NOT_FOUND);
		return rows[0];
	}

	// Rollback limpio: cierra el período (status=INA, is_active=false) si NO tiene dependencias.
	// Decisión de diseño: no eliminamos físicamente (los IDs pueden estar referenciados por
	// study_plan_academic_periods/program_commissions creados en otras fases). Soft-close + guards FK.
	async deletePeriod(id: number): Promise<{ success: boolean }> {
		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();
		try {
			await this.findPeriod(id); // asserts existence

			await this.assertNoDependencies(queryRunner.manager, id);

			await queryRunner.manager.query(
				`UPDATE academic.academic_periods
				 SET status = $1, is_active = false, updated_at = NOW()
				 WHERE id = $2`,
				[PERIOD_STATUS_INACTIVE, id],
			);

			await queryRunner.commitTransaction();
			return { success: true };
		} catch (err) {
			await queryRunner.rollbackTransaction();
			throw err;
		} finally {
			await queryRunner.release();
		}
	}

	// %% GUARDS

	private assertDateRange(start: string, end: string): void {
		if (new Date(end) < new Date(start)) {
			throw new HttpException(
				{ message: 'end_date no puede ser anterior a start_date', errors: ['end_date < start_date'] },
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	private assertModalitySupported(code: string): void {
		if (!PERIOD_MODALITY_CODES.includes(code as any)) {
			throw new HttpException(
				{ message: 'modality_code inválido', errors: [`expected one of: ${PERIOD_MODALITY_CODES.join(', ')}`] },
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	private async assertCodeUnique(manager: EntityManager, code: string): Promise<void> {
		const existing: Array<{ id: number }> = await manager.query(
			'SELECT id FROM academic.academic_periods WHERE code = $1',
			[code],
		);
		if (existing.length > 0) {
			throw new HttpException(
				{ message: 'Ya existe un período con ese código', errors: [`code=${code}`] },
				HttpStatus.CONFLICT,
			);
		}
	}

	private async resolveModalityTypeId(manager: EntityManager, code: string): Promise<number> {
		const rows: Array<{ id: number }> = await manager.query(
			`SELECT t.id FROM core.types t
			 JOIN core.type_groups g ON g.id = t.type_group_id
			 WHERE g.code = $1 AND t.code = $2`,
			[MODALITY_TYPE_GROUP_CODE, code],
		);
		if (rows.length === 0) {
			throw new HttpException(
				{ message: 'Modalidad no encontrada en core.types', errors: [`MODALITY_TYPE.${code}`] },
				HttpStatus.NOT_FOUND,
			);
		}
		return rows[0].id;
	}

	private async assertNoDependencies(manager: EntityManager, periodId: number): Promise<void> {
		const blockers: Array<{ kind: string; n: number }> = await manager.query(
			`SELECT 'study_plan_academic_periods' AS kind, COUNT(*)::int AS n FROM academic.study_plan_academic_periods WHERE academic_period_id = $1
			 UNION ALL
			 SELECT 'program_commissions',              COUNT(*)::int       FROM accreditation.program_commissions WHERE academic_period_id = $1`,
			[periodId],
		);
		const offenders = blockers.filter((b) => b.n > 0);
		if (offenders.length > 0) {
			throw new HttpException(
				{
					message: 'No se puede cerrar el período: hay dependencias activas',
					errors: offenders.map((b) => `${b.kind}: ${b.n}`),
				},
				HttpStatus.CONFLICT,
			);
		}
	}
}
