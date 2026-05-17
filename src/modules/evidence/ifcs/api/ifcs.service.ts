import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { IfcRepository } from '../core/ifcs.repository';
import { IfcValidation, IfcTransitionContext, IfcTransitionOp } from '../core/ifcs.validation';

import { CreateIfcDto, ListIfcsDto, RejectIfcDto, UpdateIfcDto } from '../model/ifcs.dtos';
import { DataSource, EntityManager } from 'typeorm';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import { I18nText } from 'src/shared/types/i18n';
import { ifcsValidationStrings } from '../config/strings/ifcs.validation';
import { IFCS_PARAMETER_KEYS } from './ifcs.constants';

@Injectable()
export class IfcService extends BaseService<IfcRepository> {
	constructor(
		protected readonly repository: IfcRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateIfcDto, manager?: EntityManager) {
		await IfcValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateIfcDto, manager?: EntityManager) {
		await IfcValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await IfcValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}

	async list(dto: ListIfcsDto) {
		return await this.dataSource.query(LIST_SQL, [dto.chart_ids, dto.period_id, TYPE_CODES.ENTITY_TYPE.COURSE]);
	}

	async getView(id: number, schoolId: number) {
		const [headerRows, findingRows, outcomeCourseRows] = await Promise.all([
			this.dataSource.query(HEADER_SQL, [id, schoolId, TYPE_CODES.CHART_LEVEL_TYPE.COURSE_COORDINATOR, TYPE_CODES.ENTITY_TYPE.SCHOOL]),
			this.dataSource.query(FINDINGS_SQL, [id, IFCS_PARAMETER_KEYS.FINDING_PREFIX]),
			this.dataSource.query(OUTCOME_COURSE_SQL, [id]),
		]);

		if (headerRows.length === 0) {
			throw new HttpException({ message: ifcsValidationStrings.result.viewFailed, errors: [ifcsValidationStrings.error.notFound] }, HttpStatus.NOT_FOUND);
		}

		const findingIds = findingRows.map((r: any) => Number(r.finding_id));
		const [findingOutcomeRows, findingActionRows] = await Promise.all([
			findingIds.length ? this.dataSource.query(FINDING_OUTCOMES_SQL, [findingIds]) : Promise.resolve([]),
			findingIds.length
				? this.dataSource.query(FINDING_ACTIONS_SQL, [findingIds, IFCS_PARAMETER_KEYS.ACTION_PREFIX, TYPE_CODES.ACTION_COMPLETENESS.PENDING, TYPE_CODES.ACTION_COMPLETENESS.IMPLEMENTED])
				: Promise.resolve([]),
		]);

		return this.assembleViewResponse({
			header: headerRows[0],
			findingRows,
			outcomeCourseRows,
			findingOutcomeRows,
			findingActionRows,
		});
	}

	async submit(ifcId: number, userId: number, schoolId: number) {
		const ctx = await this.loadTransitionContext(ifcId, userId, schoolId, 'submit');
		IfcValidation.assertOwnCoordinator(ctx, 'submit');
		IfcValidation.assertCurrentStatus(ctx.currentStatusCode, [null, TYPE_CODES.IFC_STATUS.SAVED], 'submit');
		return await this.insertStatus(ctx, TYPE_CODES.IFC_STATUS.SUBMITTED, null);
	}

	async approve(ifcId: number, userId: number, schoolId: number) {
		const ctx = await this.loadTransitionContext(ifcId, userId, schoolId, 'approve');
		IfcValidation.assertNotOwnCoordinator(ctx, 'approve');
		IfcValidation.assertCurrentStatus(ctx.currentStatusCode, [TYPE_CODES.IFC_STATUS.SUBMITTED], 'approve');
		return await this.insertStatus(ctx, TYPE_CODES.IFC_STATUS.APPROVED, null);
	}

	async reject(ifcId: number, userId: number, schoolId: number, dto: RejectIfcDto) {
		const ctx = await this.loadTransitionContext(ifcId, userId, schoolId, 'reject');
		IfcValidation.assertNotOwnCoordinator(ctx, 'reject');
		IfcValidation.assertCurrentStatus(ctx.currentStatusCode, [TYPE_CODES.IFC_STATUS.SUBMITTED], 'reject');
		return await this.insertStatus(ctx, TYPE_CODES.IFC_STATUS.OBSERVED, dto.comment);
	}

	private async loadTransitionContext(ifcId: number, userId: number, schoolId: number, op: IfcTransitionOp): Promise<IfcTransitionContext> {
		const rows = await this.dataSource.query(TRANSITION_CONTEXT_SQL, [ifcId, schoolId, userId, TYPE_CODES.CHART_LEVEL_TYPE.COURSE_COORDINATOR, TYPE_CODES.ENTITY_TYPE.SCHOOL]);

		if (rows.length === 0) {
			throw new HttpException({ message: ifcsValidationStrings.result[`${op}Failed`], errors: [ifcsValidationStrings.error.notFound] }, HttpStatus.NOT_FOUND);
		}

		const row = rows[0];
		const ctx: IfcTransitionContext = {
			ifcId,
			ifcCourseStaffId: row.ifc_course_staff_id === null ? null : Number(row.ifc_course_staff_id),
			requesterStaffId: row.requester_staff_id === null ? null : Number(row.requester_staff_id),
			currentStatusCode: row.current_status_code ?? null,
		};

		IfcValidation.assertRequesterIsStaff(ctx.requesterStaffId, op);
		return ctx;
	}

	private async insertStatus(ctx: IfcTransitionContext, newStatusCode: string, comment: I18nText | null) {
		const rows = await this.dataSource.query(INSERT_STATUS_SQL, [ctx.ifcId, newStatusCode, ctx.requesterStaffId, comment ? JSON.stringify(comment) : null]);
		return rows[0];
	}

	private assembleViewResponse(input: { header: any; findingRows: any[]; outcomeCourseRows: any[]; findingOutcomeRows: any[]; findingActionRows: any[] }) {
		const { header, findingRows, outcomeCourseRows, findingOutcomeRows, findingActionRows } = input;

		const ifc = {
			id: Number(header.ifc_id),
			information: header.information,
			extra: header.extra,
			created_at: header.ifc_created_at,
			academic_period_code: header.academic_period_code,
			area_label: header.area_label,
			subarea_label: header.subarea_label,
			course_name: header.course_name,
			course_learning_outcome: header.course_learning_outcome,
			coordinator: {
				user_id: header.coordinator_user_id === null ? null : Number(header.coordinator_user_id),
				code: header.coordinator_code ?? null,
				name: header.coordinator_name,
			},
			status: header.status_code
				? {
						code: header.status_code,
						name: header.status_name,
						at: header.status_at,
						comment: header.status_comment ?? null,
						by: header.status_by_name ?? null,
					}
				: null,
		};

		const outcomesByFinding = new Map<number, any[]>();
		for (const row of findingOutcomeRows) {
			const fid = Number(row.finding_id);
			const arr = outcomesByFinding.get(fid) ?? [];
			arr.push({
				outcome_code: row.outcome_code,
				outcome_name: row.outcome_name,
				outcome_description: row.outcome_description,
				commission: { code: row.commission_code, name: row.commission_name },
			});
			outcomesByFinding.set(fid, arr);
		}

		const actionsByFinding = new Map<number, any[]>();
		for (const row of findingActionRows) {
			const fid = Number(row.finding_id);
			const arr = actionsByFinding.get(fid) ?? [];
			arr.push({
				id: Number(row.action_id),
				code: row.action_code,
				description: row.action_description,
				correlative: row.action_correlative,
				completeness_code: row.completeness_code,
				completeness_name: row.completeness_name,
			});
			actionsByFinding.set(fid, arr);
		}

		const findings = findingRows.map((row: any) => {
			const fid = Number(row.finding_id);
			return {
				id: fid,
				code: row.finding_code,
				description: row.finding_description,
				correlative: row.finding_correlative,
				is_automatic: row.is_automatic,
				criticality: { code: row.criticality_code, name: row.criticality_name },
				outcomes: outcomesByFinding.get(fid) ?? [],
				actions: actionsByFinding.get(fid) ?? [],
			};
		});

		const programIndex = new Map<string, { program_code: string; program_name: I18nText; commissions: Map<string, any> }>();
		for (const row of outcomeCourseRows) {
			let pg = programIndex.get(row.program_code);
			if (!pg) {
				pg = { program_code: row.program_code, program_name: row.program_name, commissions: new Map() };
				programIndex.set(row.program_code, pg);
			}
			let cm = pg.commissions.get(row.commission_code);
			if (!cm) {
				cm = { commission_code: row.commission_code, commission_name: row.commission_name, outcomes: [] as any[] };
				pg.commissions.set(row.commission_code, cm);
			}
			cm.outcomes.push({
				outcome_code: row.outcome_code,
				outcome_name: row.outcome_name,
				outcome_description: row.outcome_description,
			});
		}

		const outcome_course_result = Array.from(programIndex.values()).map((pg) => ({
			program_code: pg.program_code,
			program_name: pg.program_name,
			commissions: Array.from(pg.commissions.values()),
		}));

		return { ifc, outcome_course_result, findings };
	}
}

const LIST_SQL = `
SELECT
	c.id::int                                          AS chart_id,
	ac.code                                            AS course_code,
	ac.name                                            AS course_name,
	c_program.level_title                              AS program_label,
	u.id::int                                          AS coordinator_user_id,
	u.first_name || ' ' || u.last_name                 AS coordinator_name,
	CASE WHEN i.id IS NULL THEN NULL ELSE jsonb_build_object(
		'id',           i.id,
		'information',  i.information,
		'extra',        i.extra,
		'created_at',   i.created_at,
		'updated_at',   i.updated_at,
		'status_code',  ifc_st.code,
		'status_label', ifc_st.name
	) END                                              AS ifc
FROM organization.charts c
JOIN core.types ct_entity            ON ct_entity.id = c.entity_type_id
JOIN academic.courses ac             ON ac.id = c.entity_code
JOIN organization.staff st           ON st.id = c.staff_id
JOIN organization.users u            ON u.id = st.user_id
JOIN organization.charts c_sub       ON c_sub.id     = c.root_chart_detail_id
JOIN organization.charts c_area      ON c_area.id    = c_sub.root_chart_detail_id
JOIN organization.charts c_program   ON c_program.id = c_area.root_chart_detail_id
LEFT JOIN evidence.ifcs i
	ON  i.course_id          = ac.id
	AND i.academic_period_id = $2
LEFT JOIN LATERAL (
	SELECT status_type_id
	FROM ifc.statuses
	WHERE ifc_id = i.id
	ORDER BY register_at DESC
	LIMIT 1
) latest_status ON true
LEFT JOIN core.types ifc_st          ON ifc_st.id = latest_status.status_type_id
WHERE c.id = ANY($1::int[])
  AND ct_entity.code = $3
ORDER BY c.id
`;

const HEADER_SQL = `
WITH course_chart AS (
	SELECT c.*
	FROM organization.charts c
	JOIN organization.chart_levels cl ON cl.id = c.chart_level_id
	JOIN core.types ct                ON ct.id = cl.level_type_id
	WHERE ct.code               = $3
	  AND c.academic_period_id  = (SELECT academic_period_id FROM evidence.ifcs WHERE id = $1)
	  AND c.entity_code         = (SELECT course_id          FROM evidence.ifcs WHERE id = $1)
	  AND c.is_active           = true
	LIMIT 1
),
school_check AS (
	SELECT 1
	FROM course_chart cc
	JOIN organization.charts c_sub     ON c_sub.id     = cc.root_chart_detail_id
	JOIN organization.charts c_area    ON c_area.id    = c_sub.root_chart_detail_id
	JOIN organization.charts c_program ON c_program.id = c_area.root_chart_detail_id
	JOIN organization.charts c_school  ON c_school.id  = c_program.root_chart_detail_id
	JOIN core.types ct_sch             ON ct_sch.id    = c_school.entity_type_id
	WHERE ct_sch.code = $4
	  AND c_school.entity_code = $2
)
SELECT
	i.id                                            AS ifc_id,
	i.information,
	i.extra,
	i.created_at                                    AS ifc_created_at,
	ap.code                                         AS academic_period_code,
	c_area.level_title                              AS area_label,
	c_sub.level_title                               AS subarea_label,
	ac.name                                         AS course_name,
	ac.learning_outcome                             AS course_learning_outcome,
	coord_u.id::int                                 AS coordinator_user_id,
	coord_prof.code                                 AS coordinator_code,
	coord_u.first_name || ' ' || coord_u.last_name  AS coordinator_name,
	ifc_st.code                                     AS status_code,
	ifc_st.name                                     AS status_name,
	latest_status.register_at                       AS status_at,
	latest_status.comment                           AS status_comment,
	u_by.first_name || ' ' || u_by.last_name        AS status_by_name
FROM evidence.ifcs i
JOIN academic.academic_periods ap ON ap.id = i.academic_period_id
JOIN academic.courses          ac ON ac.id = i.course_id
JOIN course_chart c_course        ON true
JOIN organization.charts c_sub    ON c_sub.id  = c_course.root_chart_detail_id
JOIN organization.charts c_area   ON c_area.id = c_sub.root_chart_detail_id
LEFT JOIN organization.staff   coord_st   ON coord_st.id   = c_course.staff_id
LEFT JOIN organization.users   coord_u    ON coord_u.id    = coord_st.user_id
LEFT JOIN academic.professors  coord_prof ON coord_prof.staff_id = coord_st.id
LEFT JOIN LATERAL (
	SELECT status_type_id, staff_id, register_at, comment
	FROM ifc.statuses
	WHERE ifc_id = i.id
	ORDER BY register_at DESC
	LIMIT 1
) latest_status ON true
LEFT JOIN core.types ifc_st         ON ifc_st.id  = latest_status.status_type_id
LEFT JOIN organization.staff st_by  ON st_by.id   = latest_status.staff_id
LEFT JOIN organization.users u_by   ON u_by.id    = st_by.user_id
WHERE i.id = $1
  AND EXISTS (SELECT 1 FROM school_check)
`;

const FINDINGS_SQL = `
SELECT
	f.id::int                          AS finding_id,
	f.correlative                      AS finding_correlative,
	f.description                      AS finding_description,
	f.is_automatic                     AS is_automatic,
	(p_fnd.value #>> '{}')
		|| '-' || inst.code
		|| CASE WHEN ac.code IS NOT NULL THEN '-' || ac.code ELSE '' END
		|| '-' || f.correlative::text  AS finding_code,
	crit.code                          AS criticality_code,
	crit.name                          AS criticality_name
FROM ifc.ifc_findings ifc_f
JOIN improvement.findings f      ON f.id    = ifc_f.finding_id
JOIN core.types crit             ON crit.id = f.criticality_type_id
JOIN evidence.instruments inst   ON inst.id = f.instrument_id
LEFT JOIN academic.courses ac    ON ac.id   = f.course_id
CROSS JOIN (SELECT value FROM core.parameters WHERE code = $2) p_fnd
WHERE ifc_f.ifc_id   = $1
  AND f.is_active    = true
ORDER BY f.correlative
`;

const FINDING_OUTCOMES_SQL = `
SELECT
	fo.finding_id::int                  AS finding_id,
	o.outcome_code                      AS outcome_code,
	o.outcome_name                      AS outcome_name,
	o.outcome_description               AS outcome_description,
	comm.code                           AS commission_code,
	comm.name                           AS commission_name
FROM improvement.finding_outcomes fo
JOIN accreditation.outcomes o                ON o.id    = fo.outcome_id
JOIN accreditation.program_commissions pc    ON pc.id   = o.program_commission_id
JOIN accreditation.commissions comm          ON comm.id = pc.commission_id
WHERE fo.finding_id = ANY($1::int[])
ORDER BY fo.finding_id, o.outcome_code
`;

const FINDING_ACTIONS_SQL = `
SELECT
	fa.finding_id::int                  AS finding_id,
	a.id::int                           AS action_id,
	a.correlative                       AS action_correlative,
	a.description                       AS action_description,
	(p_acn.value #>> '{}')
		|| '-' || inst.code
		|| CASE WHEN ac.code IS NOT NULL THEN '-' || ac.code ELSE '' END
		|| '-' || a.correlative::text   AS action_code,
	CASE WHEN fa.evidences IS NULL THEN $3 ELSE $4 END  AS completeness_code,
	comp.name                           AS completeness_name
FROM improvement.finding_actions fa
JOIN improvement.actions  a      ON a.id    = fa.action_id
JOIN improvement.findings f      ON f.id    = fa.finding_id
JOIN evidence.instruments inst   ON inst.id = f.instrument_id
LEFT JOIN academic.courses ac    ON ac.id   = f.course_id
CROSS JOIN (SELECT value FROM core.parameters WHERE code = $2) p_acn
LEFT JOIN core.types comp        ON comp.code = (CASE WHEN fa.evidences IS NULL THEN $3 ELSE $4 END)
WHERE fa.finding_id = ANY($1::int[])
  AND a.is_active   = true
ORDER BY fa.finding_id, a.correlative
`;

const OUTCOME_COURSE_SQL = `
SELECT
	p.code                              AS program_code,
	p.name                              AS program_name,
	comm.code                           AS commission_code,
	comm.name                           AS commission_name,
	o.outcome_code                      AS outcome_code,
	o.outcome_name                      AS outcome_name,
	o.outcome_description               AS outcome_description
FROM evidence.ifcs i
JOIN academic.study_plan_courses spc        ON spc.course_id = i.course_id
JOIN academic.course_outcome_mappings m     ON m.study_plan_course_id = spc.id
JOIN accreditation.outcomes o               ON o.id    = m.outcome_id
JOIN accreditation.program_commissions pc   ON pc.id   = o.program_commission_id
JOIN academic.programs p                    ON p.id    = pc.program_id
JOIN accreditation.commissions comm         ON comm.id = pc.commission_id
WHERE i.id = $1
ORDER BY p.code, comm.code, o.outcome_code
`;

const TRANSITION_CONTEXT_SQL = `
WITH course_chart AS (
	SELECT c.staff_id
	FROM organization.charts c
	JOIN organization.chart_levels cl ON cl.id = c.chart_level_id
	JOIN core.types ct                ON ct.id = cl.level_type_id
	WHERE ct.code               = $4
	  AND c.academic_period_id  = (SELECT academic_period_id FROM evidence.ifcs WHERE id = $1)
	  AND c.entity_code         = (SELECT course_id          FROM evidence.ifcs WHERE id = $1)
	  AND c.is_active           = true
	LIMIT 1
),
school_check AS (
	SELECT 1
	FROM organization.charts c
	JOIN organization.chart_levels cl ON cl.id = c.chart_level_id
	JOIN core.types ct                ON ct.id = cl.level_type_id
	WHERE ct.code               = $4
	  AND c.academic_period_id  = (SELECT academic_period_id FROM evidence.ifcs WHERE id = $1)
	  AND c.entity_code         = (SELECT course_id          FROM evidence.ifcs WHERE id = $1)
	  AND c.is_active           = true
	  AND EXISTS (
			SELECT 1
			FROM organization.charts c_sub
			JOIN organization.charts c_area    ON c_area.id    = c_sub.root_chart_detail_id
			JOIN organization.charts c_program ON c_program.id = c_area.root_chart_detail_id
			JOIN organization.charts c_school  ON c_school.id  = c_program.root_chart_detail_id
			JOIN core.types ct_sch             ON ct_sch.id    = c_school.entity_type_id
			WHERE c_sub.id           = c.root_chart_detail_id
			  AND ct_sch.code        = $5
			  AND c_school.entity_code = $2
	  )
)
SELECT
	(SELECT staff_id FROM course_chart)::int   AS ifc_course_staff_id,
	rs.id::int                                  AS requester_staff_id,
	ifc_st.code                                 AS current_status_code
FROM evidence.ifcs i
LEFT JOIN organization.staff rs ON rs.user_id = $3
LEFT JOIN LATERAL (
	SELECT status_type_id
	FROM ifc.statuses
	WHERE ifc_id = i.id
	ORDER BY register_at DESC
	LIMIT 1
) latest_status ON true
LEFT JOIN core.types ifc_st ON ifc_st.id = latest_status.status_type_id
WHERE i.id = $1
  AND EXISTS (SELECT 1 FROM school_check)
`;

const INSERT_STATUS_SQL = `
WITH new_status AS (
	INSERT INTO ifc.statuses (ifc_id, status_type_id, staff_id, register_at, comment, is_active)
	SELECT $1, t.id, $3, NOW(), $4::jsonb, true
	FROM core.types t
	WHERE t.code = $2
	RETURNING id, ifc_id, status_type_id, staff_id, register_at, comment
)
SELECT
	t.code                                                   AS code,
	t.name                                                   AS name,
	ns.register_at                                           AS at,
	ns.comment                                               AS comment,
	u.first_name || ' ' || u.last_name                       AS by
FROM new_status ns
JOIN core.types t       ON t.id  = ns.status_type_id
LEFT JOIN organization.staff st ON st.id = ns.staff_id
LEFT JOIN organization.users u  ON u.id  = st.user_id
`;
