import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ProgramCommissionResponse } from '../model/program-commissions.dtos';

// Réplica de DataUploadBaseService.AsociateCareerWithCommission (legacy ABET 2025).
// Asocia un programa/carrera con una comisión acreditadora dentro de un período académico.
// Blueprint §2 FASE_0 nodo C "Asociación Carrera - Comisión" + §3.1 tabla CarreraComision.

@Injectable()
export class ProgramCommissionsService {
	constructor(private readonly dataSource: DataSource) {}

	// POST /configuration/periods/:periodId/program-commissions
	async associate(periodId: number, programId: number, commissionId: number): Promise<ProgramCommissionResponse> {
		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();
		try {
			await this.assertPeriodExists(queryRunner.manager, periodId);
			await this.assertProgramExists(queryRunner.manager, programId);
			await this.assertCommissionExists(queryRunner.manager, commissionId);
			await this.assertNotAlreadyAssociated(queryRunner.manager, periodId, programId, commissionId);

			const inserted: Array<ProgramCommissionResponse> = await queryRunner.manager.query(
				`INSERT INTO accreditation.program_commissions
				 (commission_id, program_id, academic_period_id, commission_type_id, extra, is_active, created_at, updated_at)
				 VALUES ($1, $2, $3, NULL, '{}'::jsonb, true, NOW(), NOW())
				 RETURNING id, academic_period_id, program_id, commission_id`,
				[commissionId, programId, periodId],
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

	// DELETE /configuration/periods/:periodId/program-commissions/:id
	// Rollback limpio: falla si ya hay outcomes colgando (signal de carga de Outcomes ejecutada).
	async unassociate(periodId: number, programCommissionId: number): Promise<{ success: boolean }> {
		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();
		try {
			await this.assertProgramCommissionExists(queryRunner.manager, periodId, programCommissionId);
			await this.assertNoOutcomeDependencies(queryRunner.manager, programCommissionId);

			await queryRunner.manager.query(
				'DELETE FROM accreditation.program_commissions WHERE id = $1 AND academic_period_id = $2',
				[programCommissionId, periodId],
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

	// GET /configuration/periods/:periodId/program-commissions
	async listByPeriod(periodId: number) {
		return await this.dataSource.query(
			`SELECT pc.id,
			        pc.academic_period_id,
			        pc.program_id,
			        pc.commission_id,
			        p.code  AS program_code,
			        c.code  AS commission_code
			 FROM accreditation.program_commissions pc
			 JOIN academic.programs p          ON p.id = pc.program_id
			 JOIN accreditation.commissions c  ON c.id = pc.commission_id
			 WHERE pc.academic_period_id = $1
			 ORDER BY p.code, c.code`,
			[periodId],
		);
	}

	// %% GUARDS

	private async assertPeriodExists(manager: EntityManager, periodId: number): Promise<void> {
		const rows: Array<{ id: number }> = await manager.query(
			'SELECT id FROM academic.academic_periods WHERE id = $1 AND is_active = true',
			[periodId],
		);
		if (rows.length === 0) throw new HttpException({ message: 'Período no encontrado o inactivo', errors: [`period_id=${periodId}`] }, HttpStatus.NOT_FOUND);
	}

	private async assertProgramExists(manager: EntityManager, programId: number): Promise<void> {
		const rows: Array<{ id: number }> = await manager.query('SELECT id FROM academic.programs WHERE id = $1', [programId]);
		if (rows.length === 0) throw new HttpException({ message: 'Programa no encontrado', errors: [`program_id=${programId}`] }, HttpStatus.NOT_FOUND);
	}

	private async assertCommissionExists(manager: EntityManager, commissionId: number): Promise<void> {
		const rows: Array<{ id: number }> = await manager.query('SELECT id FROM accreditation.commissions WHERE id = $1', [commissionId]);
		if (rows.length === 0) throw new HttpException({ message: 'Comisión no encontrada', errors: [`commission_id=${commissionId}`] }, HttpStatus.NOT_FOUND);
	}

	private async assertNotAlreadyAssociated(manager: EntityManager, periodId: number, programId: number, commissionId: number): Promise<void> {
		const rows: Array<{ id: number }> = await manager.query(
			'SELECT id FROM accreditation.program_commissions WHERE academic_period_id = $1 AND program_id = $2 AND commission_id = $3',
			[periodId, programId, commissionId],
		);
		if (rows.length > 0) {
			throw new HttpException(
				{ message: 'La carrera ya está asociada a esta comisión en este período', errors: [`program_commission_id=${rows[0].id}`] },
				HttpStatus.CONFLICT,
			);
		}
	}

	private async assertProgramCommissionExists(manager: EntityManager, periodId: number, id: number): Promise<void> {
		const rows: Array<{ id: number }> = await manager.query(
			'SELECT id FROM accreditation.program_commissions WHERE id = $1 AND academic_period_id = $2',
			[id, periodId],
		);
		if (rows.length === 0) {
			throw new HttpException(
				{ message: 'Asociación carrera-comisión no encontrada en este período', errors: [`program_commission_id=${id}`, `period_id=${periodId}`] },
				HttpStatus.NOT_FOUND,
			);
		}
	}

	private async assertNoOutcomeDependencies(manager: EntityManager, programCommissionId: number): Promise<void> {
		const rows: Array<{ n: number }> = await manager.query(
			'SELECT COUNT(*)::int AS n FROM accreditation.outcomes WHERE program_commission_id = $1',
			[programCommissionId],
		);
		if (rows[0].n > 0) {
			throw new HttpException(
				{ message: 'No se puede revertir: ya hay outcomes asociados', errors: [`outcomes=${rows[0].n}`] },
				HttpStatus.CONFLICT,
			);
		}
	}
}
