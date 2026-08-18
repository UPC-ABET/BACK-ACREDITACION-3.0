import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { ConflictError } from 'src/commons/domain-error';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import { ChartEntity } from 'src/modules/organization/charts/model/charts.entity';
import { UNIQUE_CHART_ENTITY_INDEX } from 'src/modules/organization/charts/core/charts.repository';
import type { I18nText } from 'src/shared/types/i18n';
import { chartHeadsValidationStrings } from '../config/strings/chart-heads.validation';
import type {
	ChartHeadDeanViewDto,
	ChartHeadDirectorViewDto,
	ChartHeadProgramViewDto,
	ChartHeadsConfigurationDto,
	ConfigureChartHeadsDto,
} from '../model/chart-heads.dtos';

const UNIQUE_VIOLATION_SQLSTATE = '23505';

interface HeadInput {
	entityTypeId: number;
	entityCode: number | null;
	rootChartId: number | null;
	academicPeriodId: number;
	staffId: number;
	userId: number | null;
	title: I18nText;
}

@Injectable()
export class ChartHeadsRepository {
	constructor(private readonly dataSource: DataSource) {}

	async academicPeriodExists(id: number): Promise<boolean> {
		const rows: Array<{ one: number }> = await this.dataSource.query(
			'SELECT 1 AS one FROM academic.academic_periods WHERE id = $1 LIMIT 1',
			[id],
		);
		return rows.length > 0;
	}

	async findMissingSchoolIds(ids: number[]): Promise<number[]> {
		if (ids.length === 0) return [];
		const found: Array<{ id: number }> = await this.dataSource.query(
			'SELECT id FROM organization.schools WHERE id = ANY($1::int[])',
			[ids],
		);
		const foundIds = new Set(found.map((r) => Number(r.id)));
		return ids.filter((id) => !foundIds.has(id));
	}

	async findMissingUserIds(ids: number[]): Promise<number[]> {
		if (ids.length === 0) return [];
		const found: Array<{ id: number }> = await this.dataSource.query(
			'SELECT id FROM organization.users WHERE id = ANY($1::int[])',
			[ids],
		);
		const foundIds = new Set(found.map((r) => Number(r.id)));
		return ids.filter((id) => !foundIds.has(id));
	}

	async findMissingStaffIds(ids: number[]): Promise<number[]> {
		if (ids.length === 0) return [];
		const found: Array<{ id: number }> = await this.dataSource.query(
			'SELECT id FROM organization.staff WHERE id = ANY($1::int[])',
			[ids],
		);
		const foundIds = new Set(found.map((r) => Number(r.id)));
		return ids.filter((id) => !foundIds.has(id));
	}

	async findMissingProgramIds(ids: number[]): Promise<number[]> {
		if (ids.length === 0) return [];
		const found: Array<{ id: number }> = await this.dataSource.query(
			'SELECT id FROM academic.programs WHERE id = ANY($1::int[])',
			[ids],
		);
		const foundIds = new Set(found.map((r) => Number(r.id)));
		return ids.filter((id) => !foundIds.has(id));
	}

	// A program re-configured for its own school is not a conflict — that is upsertHead's
	// ordinary idempotent-update case — so excludeSchoolId excludes it here.
	async findProgramsConfiguredForOtherSchool(
		programIds: number[],
		academicPeriodId: number,
		excludeSchoolId: number,
	): Promise<number[]> {
		if (programIds.length === 0) return [];
		const rows: Array<{ programId: number }> = await this.dataSource.query(
			`SELECT ch_prog.entity_code AS "programId"
			 FROM organization.charts ch_prog
			 INNER JOIN core.types prog_t ON prog_t.id = ch_prog.entity_type_id
			 INNER JOIN organization.charts ch_sch ON ch_sch.id = ch_prog.root_chart_id
			 INNER JOIN core.types sch_t ON sch_t.id = ch_sch.entity_type_id
			 WHERE prog_t.code = $1
			   AND sch_t.code = $2
			   AND ch_prog.academic_period_id = $3
			   AND ch_prog.entity_code = ANY($4::int[])
			   AND ch_prog.is_active = true
			   AND ch_sch.entity_code <> $5`,
			[
				TYPE_CODES.ENTITY_TYPE.PROGRAM,
				TYPE_CODES.ENTITY_TYPE.SCHOOL,
				academicPeriodId,
				programIds,
				excludeSchoolId,
			],
		);
		return rows.map((r) => Number(r.programId));
	}

	async configure(dto: ConfigureChartHeadsDto): Promise<void> {
		await this.dataSource.transaction(async (manager) => {
			const deanTypeId = await this.typeIdByCode(manager, TYPE_CODES.ENTITY_TYPE.DEAN);
			const schoolTypeId = await this.typeIdByCode(manager, TYPE_CODES.ENTITY_TYPE.SCHOOL);
			const programTypeId = await this.typeIdByCode(manager, TYPE_CODES.ENTITY_TYPE.PROGRAM);

			const deanChartId = await this.upsertHead(manager, {
				entityTypeId: deanTypeId,
				entityCode: null,
				rootChartId: null,
				academicPeriodId: dto.academicPeriodId,
				staffId: dto.dean.staffId,
				userId: dto.dean.userId ?? null,
				title: dto.dean.title,
			});

			for (const director of dto.directors) {
				const directorChartId = await this.upsertHead(manager, {
					entityTypeId: schoolTypeId,
					entityCode: director.schoolId,
					rootChartId: deanChartId,
					academicPeriodId: dto.academicPeriodId,
					staffId: director.staffId,
					userId: director.userId ?? null,
					title: director.title,
				});

				for (const program of director.programs ?? []) {
					await this.upsertHead(manager, {
						entityTypeId: programTypeId,
						entityCode: program.programId,
						rootChartId: directorChartId,
						academicPeriodId: dto.academicPeriodId,
						staffId: program.staffId,
						userId: program.userId ?? null,
						title: program.title,
					});
				}
			}
		});
	}

	async getConfiguration(academicPeriodId: number): Promise<ChartHeadsConfigurationDto> {
		const deanRows: ChartHeadDeanViewDto[] = await this.dataSource.query(
			`SELECT c.id AS "chartId", s.id AS "staffId", p.code AS "code",
				s.first_name AS "firstName", s.last_name AS "lastName", s.user_id AS "userId",
				CASE WHEN u.id IS NULL THEN NULL ELSE
					json_build_object('id', u.id, 'firstName', u.first_name, 'lastName', u.last_name,
						'email', u.email)
				END AS "user",
				c.title AS "title"
			 FROM organization.charts c
			 JOIN organization.staff s ON s.id = c.staff_id
			 JOIN core.types et ON et.id = c.entity_type_id
			 LEFT JOIN academic.professors p ON p.staff_id = s.id
			 LEFT JOIN organization.users u ON u.id = s.user_id
			 WHERE c.academic_period_id = $1 AND et.code = $2 AND c.is_active = true
			 ORDER BY c.id
			 LIMIT 1`,
			[academicPeriodId, TYPE_CODES.ENTITY_TYPE.DEAN],
		);

		const directors: ChartHeadDirectorViewDto[] = await this.dataSource.query(
			`SELECT c.id AS "chartId", s.id AS "staffId", p.code AS "code",
				s.first_name AS "firstName", s.last_name AS "lastName", s.user_id AS "userId",
				CASE WHEN u.id IS NULL THEN NULL ELSE
					json_build_object('id', u.id, 'firstName', u.first_name, 'lastName', u.last_name,
						'email', u.email)
				END AS "user",
				c.title AS "title", c.entity_code AS "schoolId", sch.code AS "schoolCode"
			 FROM organization.charts c
			 JOIN organization.staff s ON s.id = c.staff_id
			 JOIN core.types et ON et.id = c.entity_type_id
			 LEFT JOIN academic.professors p ON p.staff_id = s.id
			 LEFT JOIN organization.users u ON u.id = s.user_id
			 LEFT JOIN organization.schools sch ON sch.id = c.entity_code
			 WHERE c.academic_period_id = $1 AND et.code = $2 AND c.is_active = true
			 ORDER BY sch.code`,
			[academicPeriodId, TYPE_CODES.ENTITY_TYPE.SCHOOL],
		);

		const programs: Array<ChartHeadProgramViewDto & { directorChartId: number }> =
			await this.dataSource.query(
				`SELECT c.id AS "chartId", s.id AS "staffId", p.code AS "code",
					s.first_name AS "firstName", s.last_name AS "lastName", s.user_id AS "userId",
					CASE WHEN u.id IS NULL THEN NULL ELSE
						json_build_object('id', u.id, 'firstName', u.first_name, 'lastName', u.last_name,
							'email', u.email)
					END AS "user",
					c.title AS "title", c.entity_code AS "programId", prog.code AS "programCode",
					c.root_chart_id AS "directorChartId"
				 FROM organization.charts c
				 JOIN organization.staff s ON s.id = c.staff_id
				 JOIN core.types et ON et.id = c.entity_type_id
				 LEFT JOIN academic.professors p ON p.staff_id = s.id
				 LEFT JOIN organization.users u ON u.id = s.user_id
				 LEFT JOIN academic.programs prog ON prog.id = c.entity_code
				 WHERE c.academic_period_id = $1 AND et.code = $2 AND c.is_active = true
				 ORDER BY prog.code`,
				[academicPeriodId, TYPE_CODES.ENTITY_TYPE.PROGRAM],
			);

		for (const director of directors) {
			director.programs = programs.filter((p) => p.directorChartId === director.chartId);
		}

		return { dean: deanRows[0] ?? null, directors };
	}

	private async typeIdByCode(manager: EntityManager, code: string): Promise<number> {
		const rows: Array<{ id: number }> = await manager.query(
			'SELECT id FROM core.types WHERE code = $1 LIMIT 1',
			[code],
		);
		return Number(rows[0].id);
	}

	private async upsertHead(manager: EntityManager, input: HeadInput): Promise<number> {
		const charts = manager.getRepository(ChartEntity);

		await this.linkUserToStaff(manager, input.staffId, input.userId);

		const existing = await charts.findOne({
			where: {
				academicPeriodId: input.academicPeriodId,
				entityTypeId: input.entityTypeId,
				...(input.entityCode === null ? {} : { entityCode: input.entityCode }),
				isActive: true,
			},
		});

		if (existing) {
			await this.translateDuplicateNode(() =>
				charts.update(existing.id, {
					staffId: input.staffId,
					title: input.title,
					rootChartId: input.rootChartId,
				}),
			);
			return existing.id;
		}

		const createdChart = await this.translateDuplicateNode(() =>
			charts.save(
				charts.create({
					staffId: input.staffId,
					academicPeriodId: input.academicPeriodId,
					rootChartId: input.rootChartId,
					title: input.title,
					entityTypeId: input.entityTypeId,
					entityCode: input.entityCode,
				}),
			),
		);
		return createdChart.id;
	}

	// Two concurrent configure() calls can both pass the pre-checks above and then race here,
	// since upsertHead writes through TypeORM's own repository, not ChartRepository — so it
	// never inherits ChartRepository's own create/update translation. Without this, the losing
	// call surfaces as a raw 500 instead of a domain conflict. Mirrors
	// ChartRepository.translateDuplicateNode; keep both in sync if the index name ever changes.
	private async translateDuplicateNode<T>(operation: () => Promise<T>): Promise<T> {
		try {
			return await operation();
		} catch (error) {
			const driver = error as { code?: string; constraint?: string };
			if (
				driver?.code === UNIQUE_VIOLATION_SQLSTATE &&
				driver?.constraint === UNIQUE_CHART_ENTITY_INDEX
			) {
				throw Object.assign(
					new ConflictError(chartHeadsValidationStrings.error.programAssignedToOtherSchool),
					{ cause: error },
				);
			}
			throw error;
		}
	}

	// "Current wins": links only when both sides are free; an existing link on either side makes this
	// a no-op (also avoids tripping the 1:1 unique index).
	private async linkUserToStaff(
		manager: EntityManager,
		staffId: number,
		userId: number | null,
	): Promise<void> {
		if (userId === null) return;
		await manager.query(
			`UPDATE organization.staff
			 SET user_id = $1, updated_at = NOW()
			 WHERE id = $2
			   AND user_id IS NULL
			   AND NOT EXISTS (SELECT 1 FROM organization.staff s2 WHERE s2.user_id = $1)`,
			[userId, staffId],
		);
	}
}
