import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, DeepPartial, EntityManager, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { ConflictError } from 'src/commons/domain-error';
import type { I18nText } from 'src/shared/types/i18n';
import { TYPE_CODES, TYPE_GROUP_CODES } from 'src/modules/core/types/constants/type-codes';
import { ChartEntity } from '../model/charts.entity';
import { chartsValidationStrings } from '../config/strings/charts.validation';

const ENTITY = TYPE_CODES.ENTITY_TYPE;

// Created by 1785730489320-enforce-unique-chart-entity-per-period. Exported because the name is a
// contract between that migration and the error translation below: rename it in one place only and
// the translation stops matching, silently turning every duplicate race back into a 500.
export const UNIQUE_CHART_ENTITY_INDEX = 'UQ_charts_academic_period_entity_type_entity_code';
const UNIQUE_VIOLATION_SQLSTATE = '23505';

export interface SchoolChartNode {
	id: number;
	rootChartId: number | null;
}

export interface ChartNodeRecord {
	id: number;
	academicPeriodId: number;
	rootChartId: number | null;
	entityTypeId: number | null;
	entityTypeCode: string | null;
	entityCode: number | null;
}

export interface MaintenanceChartNode {
	chartId: number;
	staffId: number;
	professorCode: string | null;
	firstName: string;
	lastName: string;
	staffTitle: I18nText;
	organizationLevelTitle: I18nText;
	entityType: { id: number; code: string; name: I18nText } | null;
	entity: { code: string; name: I18nText } | null;
	children: MaintenanceChartNode[];
}

interface BranchRow {
	chartId: number;
	rootChartId: number | null;
	staffId: number;
	professorCode: string | null;
	firstName: string;
	lastName: string;
	staffTitle: I18nText;
	organizationLevelTitle: I18nText;
	entityTypeId: number | null;
	entityTypeCode: string | null;
	entityTypeName: I18nText | null;
	entityCode: number | null;
	entityResolvedCode: string | null;
	entityResolvedName: I18nText | null;
}

export class ChartRepository extends BaseRepository<ChartEntity> {
	constructor(
		@InjectRepository(ChartEntity)
		repository: Repository<ChartEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	// Validation catches duplicates on the way in, but two concurrent writes can both pass it and
	// let the partial unique index decide. Without this the loser gets a raw driver error, which
	// AllExceptionsFilter reports as a 500 — so a lost race would look like a server fault rather
	// than the same conflict a serial duplicate produces.
	private async translateDuplicateNode<T>(operation: () => Promise<T>): Promise<T> {
		try {
			return await operation();
		} catch (error) {
			const driver = error as { code?: string; constraint?: string };
			// Both, never the SQLSTATE alone: other unique constraints must keep their own error.
			if (
				driver?.code === UNIQUE_VIOLATION_SQLSTATE &&
				driver?.constraint === UNIQUE_CHART_ENTITY_INDEX
			) {
				// Keep the driver error as the cause: if the index is ever renamed this branch stops
				// matching, and the original is the only thing that says why.
				throw Object.assign(
					new ConflictError(chartsValidationStrings.error.entityAlreadyAssigned),
					{ cause: error },
				);
			}
			throw error;
		}
	}

	public override async create(
		data: DeepPartial<ChartEntity>,
		manager?: EntityManager,
	): Promise<ChartEntity> {
		return await this.translateDuplicateNode(() => super.create(data, manager));
	}

	public override async update(
		id: number,
		partial: DeepPartial<ChartEntity>,
		manager?: EntityManager,
	) {
		return await this.translateDuplicateNode(() => super.update(id, partial, manager));
	}

	async getSchoolChartNode(
		academicPeriodId: number,
		schoolId: number,
	): Promise<SchoolChartNode | null> {
		const [row] = await this.dataSource.query(
			`SELECT c.id, c.root_chart_id AS "rootChartId"
			 FROM organization.charts c
			 INNER JOIN core.types et ON et.id = c.entity_type_id
			 WHERE c.academic_period_id = $1
			   AND et.code = $2
			   AND c.entity_code = $3
			   AND c.is_active = true
			 ORDER BY c.id
			 LIMIT 1`,
			[academicPeriodId, ENTITY.SCHOOL, schoolId],
		);
		return row ?? null;
	}

	async getMaintenanceBranch(
		rootChartId: number,
		schoolChartId: number,
	): Promise<MaintenanceChartNode | null> {
		const rows: BranchRow[] = await this.dataSource.query(
			`WITH RECURSIVE branch AS (
				SELECT c.id, c.root_chart_id, 0 AS depth
				FROM organization.charts c
				WHERE c.id = $1 AND c.is_active = true
				UNION ALL
				SELECT c.id, c.root_chart_id, b.depth + 1
				FROM organization.charts c
				INNER JOIN branch b ON c.root_chart_id = b.id
				WHERE c.is_active = true AND (b.depth > 0 OR c.id = $2)
			)
			SELECT
				c.id               AS "chartId",
				c.root_chart_id    AS "rootChartId",
				c.staff_id         AS "staffId",
				prof.code          AS "professorCode",
				COALESCE(u.first_name, s.first_name) AS "firstName",
				COALESCE(u.last_name, s.last_name)   AS "lastName",
				s.job_title        AS "staffTitle",
				c.title            AS "organizationLevelTitle",
				et.id              AS "entityTypeId",
				et.code            AS "entityTypeCode",
				et.name            AS "entityTypeName",
				c.entity_code      AS "entityCode",
				COALESCE(sch.code, prog.code, crs.code) AS "entityResolvedCode",
				COALESCE(sch.name, prog.name, crs.name) AS "entityResolvedName"
			FROM branch b
			INNER JOIN organization.charts c ON c.id = b.id
			INNER JOIN organization.staff   s ON s.id = c.staff_id
			LEFT JOIN organization.users    u ON u.id = s.user_id
			LEFT JOIN academic.professors   prof ON prof.staff_id = s.id
			LEFT JOIN core.types            et ON et.id = c.entity_type_id
			LEFT JOIN organization.schools  sch ON et.code = $3 AND sch.id  = c.entity_code
			LEFT JOIN academic.programs     prog ON et.code = $4 AND prog.id = c.entity_code
			LEFT JOIN academic.courses      crs ON et.code = $5 AND crs.id  = c.entity_code
			ORDER BY c.id`,
			[rootChartId, schoolChartId, ENTITY.SCHOOL, ENTITY.PROGRAM, ENTITY.COURSE],
		);

		if (rows.length === 0) return null;

		const nodes = new Map<number, MaintenanceChartNode>();
		for (const row of rows) {
			nodes.set(row.chartId, {
				chartId: row.chartId,
				staffId: row.staffId,
				professorCode: row.professorCode,
				firstName: row.firstName,
				lastName: row.lastName,
				staffTitle: row.staffTitle,
				organizationLevelTitle: row.organizationLevelTitle,
				entityType:
					row.entityTypeId !== null && row.entityTypeCode !== null
						? {
								id: row.entityTypeId,
								code: row.entityTypeCode,
								name: row.entityTypeName as I18nText,
							}
						: null,
				entity:
					row.entityResolvedCode !== null
						? { code: row.entityResolvedCode, name: row.entityResolvedName as I18nText }
						: null,
				children: [],
			});
		}

		let root: MaintenanceChartNode | null = null;
		for (const row of rows) {
			const node = nodes.get(row.chartId)!;
			const parent = row.rootChartId !== null ? nodes.get(row.rootChartId) : undefined;
			if (parent) parent.children.push(node);
			else root = node;
		}
		return root;
	}

	async getNodeWithType(id: number): Promise<ChartNodeRecord | null> {
		const [row] = await this.dataSource.query(
			`SELECT
				c.id,
				c.academic_period_id AS "academicPeriodId",
				c.root_chart_id      AS "rootChartId",
				c.entity_type_id     AS "entityTypeId",
				et.code              AS "entityTypeCode",
				c.entity_code        AS "entityCode"
			FROM organization.charts c
			LEFT JOIN core.types et ON et.id = c.entity_type_id
			WHERE c.id = $1 AND c.is_active = true`,
			[id],
		);
		return row ?? null;
	}

	// True when chartId itself, or any ancestor reached by walking root_chart_id upward, is
	// Program-typed. chartId === null means no parent at all, so no ancestor.
	async hasProgramAncestor(chartId: number | null): Promise<boolean> {
		if (chartId === null) return false;
		const [row] = await this.dataSource.query(
			`WITH RECURSIVE up AS (
				SELECT c.id, c.root_chart_id, c.entity_type_id
				FROM organization.charts c
				WHERE c.id = $1 AND c.is_active = true
				UNION ALL
				SELECT c.id, c.root_chart_id, c.entity_type_id
				FROM organization.charts c
				INNER JOIN up ON c.id = up.root_chart_id
				WHERE c.is_active = true
			)
			SELECT EXISTS (
				SELECT 1 FROM up
				INNER JOIN core.types et ON et.id = up.entity_type_id
				WHERE et.code = $2
			) AS "hasProgram"`,
			[chartId, ENTITY.PROGRAM],
		);
		return Boolean(row?.hasProgram);
	}

	async getEntityTypeCode(entityTypeId: number): Promise<string | null> {
		const [row] = await this.dataSource.query(
			`SELECT t.code
			 FROM core.types t
			 INNER JOIN core.type_groups tg ON tg.id = t.type_group_id
			 WHERE t.id = $1 AND tg.code = $2`,
			[entityTypeId, TYPE_GROUP_CODES.ENTITY_TYPE],
		);
		return row?.code ?? null;
	}

	async staffExists(staffId: number): Promise<boolean> {
		const rows = await this.dataSource.query(
			'SELECT 1 FROM organization.staff WHERE id = $1 AND is_active = true LIMIT 1',
			[staffId],
		);
		return rows.length > 0;
	}

	// Only active nodes hold a slot: a deactivated node must not block re-adding its entity.
	// BaseRepository.findOneByCondition does not filter is_active, so the flag is explicit here.
	async findActiveNodeByEntity(
		academicPeriodId: number,
		entityTypeId: number,
		entityCode: number,
	): Promise<{ id: number } | null> {
		const node = await this.repository.findOne({
			select: { id: true },
			where: { academicPeriodId, entityTypeId, entityCode, isActive: true },
		});
		return node ? { id: node.id } : null;
	}

	async entityExists(entityTypeCode: string, entityCode: number): Promise<boolean> {
		const table =
			entityTypeCode === ENTITY.SCHOOL
				? 'organization.schools'
				: entityTypeCode === ENTITY.PROGRAM
					? 'academic.programs'
					: entityTypeCode === ENTITY.COURSE
						? 'academic.courses'
						: null;
		if (!table) return false;
		const rows = await this.dataSource.query(
			`SELECT 1 FROM ${table} WHERE id = $1 AND is_active = true LIMIT 1`,
			[entityCode],
		);
		return rows.length > 0;
	}

	async createNode(data: {
		staffId: number;
		academicPeriodId: number;
		rootChartId: number;
		title: I18nText;
		entityTypeId: number;
		entityCode: number | null;
	}): Promise<ChartEntity> {
		return await this.create(data);
	}

	async updateNode(
		id: number,
		partial: {
			staffId?: number;
			title?: I18nText;
			entityTypeId?: number;
			entityCode?: number | null;
		},
	): Promise<void> {
		// Writes through the TypeORM repository rather than BaseRepository.update, so it does not
		// inherit the override above and must wrap the translation itself. Switching to super.update
		// is not equivalent: that throws NotFoundException on affected === 0 and returns the entity.
		await this.translateDuplicateNode(() => this.repository.update(id, partial));
	}

	async getSubtreeChartIds(id: number): Promise<number[]> {
		const rows: Array<{ id: number }> = await this.dataSource.query(
			`WITH RECURSIVE sub AS (
				SELECT id FROM organization.charts WHERE id = $1
				UNION ALL
				SELECT c.id FROM organization.charts c
				INNER JOIN sub ON c.root_chart_id = sub.id
			)
			SELECT id FROM sub`,
			[id],
		);
		return rows.map((row) => row.id);
	}

	async countCourseIfcInSubtree(id: number): Promise<number> {
		const [row] = await this.dataSource.query(
			`WITH RECURSIVE sub AS (
				SELECT id, entity_type_id, entity_code, academic_period_id
				FROM organization.charts WHERE id = $1
				UNION ALL
				SELECT c.id, c.entity_type_id, c.entity_code, c.academic_period_id
				FROM organization.charts c
				INNER JOIN sub ON c.root_chart_id = sub.id
			)
			SELECT COUNT(*)::int AS "count"
			FROM sub
			INNER JOIN core.types et ON et.id = sub.entity_type_id AND et.code = $2
			INNER JOIN evidence.ifcs i
			       ON i.course_id = sub.entity_code
			      AND i.academic_period_id = sub.academic_period_id`,
			[id, ENTITY.COURSE],
		);
		return Number(row.count);
	}

	async hardDeleteCharts(ids: number[]): Promise<void> {
		if (ids.length === 0) return;
		await this.dataSource.query('DELETE FROM organization.charts WHERE id = ANY($1::int[])', [ids]);
	}
}
