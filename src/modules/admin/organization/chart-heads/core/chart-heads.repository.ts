import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import { ChartEntity } from 'src/modules/organization/charts/model/charts.entity';
import { StaffEntity } from 'src/modules/organization/staff/model/staff.entity';
import type { I18nText } from 'src/shared/types/i18n';
import type {
	ChartHeadDeanViewDto,
	ChartHeadDirectorViewDto,
	ChartHeadsConfigurationDto,
	ConfigureChartHeadsDto,
} from '../model/chart-heads.dtos';

interface HeadInput {
	entityTypeId: number;
	entityCode: number | null;
	rootChartId: number | null;
	academicPeriodId: number;
	firstName: string;
	lastName: string;
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

	// One transaction: upsert the single Dean node, then upsert each School Director node hung under it.
	async configure(dto: ConfigureChartHeadsDto): Promise<void> {
		await this.dataSource.transaction(async (manager) => {
			const deanTypeId = await this.typeIdByCode(manager, TYPE_CODES.ENTITY_TYPE.DEAN);
			const schoolTypeId = await this.typeIdByCode(manager, TYPE_CODES.ENTITY_TYPE.SCHOOL);

			const deanChartId = await this.upsertHead(manager, {
				entityTypeId: deanTypeId,
				entityCode: null,
				rootChartId: null,
				academicPeriodId: dto.academicPeriodId,
				firstName: dto.dean.firstName,
				lastName: dto.dean.lastName,
				userId: dto.dean.userId ?? null,
				title: dto.dean.title,
			});

			for (const director of dto.directors) {
				await this.upsertHead(manager, {
					entityTypeId: schoolTypeId,
					entityCode: director.schoolId,
					rootChartId: deanChartId,
					academicPeriodId: dto.academicPeriodId,
					firstName: director.firstName,
					lastName: director.lastName,
					userId: director.userId ?? null,
					title: director.title,
				});
			}
		});
	}

	async getConfiguration(academicPeriodId: number): Promise<ChartHeadsConfigurationDto> {
		const deanRows: ChartHeadDeanViewDto[] = await this.dataSource.query(
			`SELECT c.id AS "chartId", s.id AS "staffId", s.first_name AS "firstName",
				s.last_name AS "lastName", s.user_id AS "userId", c.title AS "title"
			 FROM organization.charts c
			 JOIN organization.staff s ON s.id = c.staff_id
			 JOIN core.types et ON et.id = c.entity_type_id
			 WHERE c.academic_period_id = $1 AND et.code = $2 AND c.is_active = true
			 ORDER BY c.id
			 LIMIT 1`,
			[academicPeriodId, TYPE_CODES.ENTITY_TYPE.DEAN],
		);

		const directors: ChartHeadDirectorViewDto[] = await this.dataSource.query(
			`SELECT c.id AS "chartId", s.id AS "staffId", s.first_name AS "firstName",
				s.last_name AS "lastName", s.user_id AS "userId", c.title AS "title",
				c.entity_code AS "schoolId", sch.code AS "schoolCode"
			 FROM organization.charts c
			 JOIN organization.staff s ON s.id = c.staff_id
			 JOIN core.types et ON et.id = c.entity_type_id
			 LEFT JOIN organization.schools sch ON sch.id = c.entity_code
			 WHERE c.academic_period_id = $1 AND et.code = $2 AND c.is_active = true
			 ORDER BY sch.code`,
			[academicPeriodId, TYPE_CODES.ENTITY_TYPE.SCHOOL],
		);

		return { dean: deanRows[0] ?? null, directors };
	}

	private async typeIdByCode(manager: EntityManager, code: string): Promise<number> {
		const rows: Array<{ id: number }> = await manager.query(
			'SELECT id FROM core.types WHERE code = $1 LIMIT 1',
			[code],
		);
		return Number(rows[0].id);
	}

	// Matches an existing node by (period + entity type [+ entity code for directors]); updates the staff
	// it points at and the node title, or creates a fresh staff + chart node. Returns the chart node id.
	private async upsertHead(manager: EntityManager, input: HeadInput): Promise<number> {
		const charts = manager.getRepository(ChartEntity);
		const staff = manager.getRepository(StaffEntity);

		const existing = await charts.findOne({
			where: {
				academicPeriodId: input.academicPeriodId,
				entityTypeId: input.entityTypeId,
				...(input.entityCode === null ? {} : { entityCode: input.entityCode }),
				isActive: true,
			},
		});

		if (existing) {
			await staff.update(existing.staffId, {
				firstName: input.firstName,
				lastName: input.lastName,
				userId: input.userId,
			});
			await charts.update(existing.id, {
				title: input.title,
				rootChartId: input.rootChartId,
			});
			return existing.id;
		}

		const createdStaff = await staff.save(
			staff.create({
				firstName: input.firstName,
				lastName: input.lastName,
				userId: input.userId,
			}),
		);
		const createdChart = await charts.save(
			charts.create({
				staffId: createdStaff.id,
				academicPeriodId: input.academicPeriodId,
				rootChartId: input.rootChartId,
				title: input.title,
				entityTypeId: input.entityTypeId,
				entityCode: input.entityCode,
			}),
		);
		return createdChart.id;
	}
}
