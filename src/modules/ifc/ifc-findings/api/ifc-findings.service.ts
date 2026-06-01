import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { IfcFindingRepository } from '../core/ifc-findings.repository';
import { IfcFindingValidation } from '../core/ifc-findings.validation';

import {
	CreateIfcFindingDto,
	ListIfcFindingsDto,
	PatchIfcFindingDto,
	UpdateIfcFindingDto,
} from '../model/ifc-findings.dtos';
import { DataSource, EntityManager } from 'typeorm';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import { IfcValidation } from 'src/modules/evidence/ifcs/core/ifcs.validation';
import { IFCS_PARAMETER_KEYS, IFC_OPS, IfcOp } from 'src/modules/evidence/ifcs/api/ifcs.constants';
import { ifcFindingsValidationStrings } from '../config/strings/ifc-findings.validation';

const DELETE_OP = 'delete' as IfcOp;
const PATCH_OP = IFC_OPS.PATCH;

@Injectable()
export class IfcFindingService extends BaseService<IfcFindingRepository> {
	constructor(
		protected readonly repository: IfcFindingRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateIfcFindingDto, manager?: EntityManager) {
		await IfcFindingValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateIfcFindingDto, manager?: EntityManager) {
		await IfcFindingValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await IfcFindingValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}

	async list(dto: ListIfcFindingsDto, schoolId: number) {
		return await this.dataSource.query(LIST_SQL, [
			dto.chartIds,
			dto.periodId,
			schoolId,
			IFCS_PARAMETER_KEYS.FINDING_PREFIX,
			TYPE_CODES.ENTITY_TYPE.SCHOOL,
		]);
	}

	async deleteWithCascade(id: number, userId: number, schoolId: number) {
		return await this.dataSource.transaction(async (em) => {
			const finding = await IfcFindingValidation.assertFindingExists(em, id);
			const courseChart = await IfcFindingValidation.resolveCourseChart(
				em,
				finding.courseId,
				finding.academicPeriodId,
				TYPE_CODES.CHART_LEVEL_TYPE.COURSE_COORDINATOR,
			);

			const staffRows = await em.query(
				'SELECT id::int AS id FROM organization.staff WHERE user_id = $1 LIMIT 1',
				[userId],
			);
			const requesterStaffId: number | null = staffRows[0]?.id ?? null;

			IfcValidation.assertRequesterIsStaff(requesterStaffId, DELETE_OP);
			await IfcValidation.assertIsInCourseChain(
				em,
				{
					ifcId: 0,
					ifcCourseStaffId: null,
					courseChartId: courseChart.id,
					requesterStaffId,
					currentStatusCode: null,
				},
				DELETE_OP,
			);

			// schoolId is consumed by assertIsInCourseChain implicitly via the chart resolution;
			// keep the param so callers can't bypass the JWT contract.
			void schoolId;

			const [deletedFindingActions] = (await em.query(
				'DELETE FROM improvement.finding_actions WHERE finding_id = $1 RETURNING action_id AS "actionId"',
				[id],
			)) as [Array<{ actionId: number }>, number];
			const actionIds: number[] = deletedFindingActions.map((r) => Number(r.actionId));

			if (actionIds.length > 0) {
				await em.query('DELETE FROM improvement.actions WHERE id = ANY($1::int[])', [actionIds]);
			}

			await em.query('DELETE FROM improvement.finding_outcomes WHERE finding_id = $1', [id]);
			await em.query('DELETE FROM ifc.ifc_findings WHERE finding_id = $1', [id]);
			await em.query('DELETE FROM improvement.findings WHERE id = $1', [id]);

			return null;
		});
	}

	async getDetail(id: number, schoolId: number) {
		const [findingRows, actionRows] = await Promise.all([
			this.dataSource.query(FINDING_HEADER_SQL, [
				id, //                                                  $1 finding_id
				schoolId, //                                            $2 school_id
				IFCS_PARAMETER_KEYS.FINDING_PREFIX, //                  $3 'PARAMETER_FINDING_PREFIX'
				TYPE_CODES.ENTITY_TYPE.SCHOOL, //                       $4 'TG903-T001'
			]),
			this.dataSource.query(FINDING_ACTIONS_SQL, [
				id, //                                                  $1 finding_id
				IFCS_PARAMETER_KEYS.ACTION_PREFIX, //                   $2 'PARAMETER_ACTION_PREFIX'
				TYPE_CODES.ACTION_COMPLETENESS.PENDING, //              $3 'TG1003-T001'
				TYPE_CODES.ACTION_COMPLETENESS.IMPLEMENTED, //          $4 'TG1003-T002'
			]),
		]);

		if (findingRows.length === 0) {
			throw new HttpException(
				{
					message: ifcFindingsValidationStrings.result.viewFailed,
					errors: [ifcFindingsValidationStrings.error.notFound],
				},
				HttpStatus.NOT_FOUND,
			);
		}

		const row = findingRows[0];
		return {
			finding: {
				id: Number(row.id),
				findingCode: row.findingCode,
				academicPeriodCode: row.academicPeriodCode,
				description: row.description,
				criticality: {
					code: row.criticalityCode,
					name: row.criticalityName,
					color: row.criticalityColor ?? null,
				},
			},
			actions: actionRows.map((a: any) => ({
				id: Number(a.id),
				actionCode: a.actionCode,
				description: a.description,
				completeness: {
					code: a.completenessCode,
					name: a.completenessName,
					color: a.completenessColor ?? null,
				},
			})),
		};
	}

	async patch(id: number, dto: PatchIfcFindingDto, userId: number, schoolId: number) {
		return await this.dataSource.transaction(async (em) => {
			const finding = await IfcFindingValidation.assertFindingExists(em, id);
			const courseChart = await IfcFindingValidation.resolveCourseChart(
				em,
				finding.courseId,
				finding.academicPeriodId,
				TYPE_CODES.CHART_LEVEL_TYPE.COURSE_COORDINATOR,
			);

			const staffRows = await em.query(
				'SELECT id::int AS id FROM organization.staff WHERE user_id = $1 LIMIT 1',
				[userId],
			);
			const requesterStaffId: number | null = staffRows[0]?.id ?? null;

			IfcValidation.assertRequesterIsStaff(requesterStaffId, PATCH_OP);
			await IfcValidation.assertIsInCourseChain(
				em,
				{
					ifcId: 0,
					ifcCourseStaffId: null,
					courseChartId: courseChart.id,
					requesterStaffId,
					currentStatusCode: null,
				},
				PATCH_OP,
			);

			await this.assertFindingInSchool(em, id, schoolId);

			await em.query(
				`UPDATE improvement.findings
				 SET description = $1::jsonb, updated_at = NOW()
				 WHERE id = $2`,
				[JSON.stringify(dto.description), id],
			);

			return { id };
		});
	}

	private async assertFindingInSchool(em: EntityManager, findingId: number, schoolId: number) {
		const rows = await em.query(
			`SELECT 1
			 FROM improvement.findings f
			 JOIN organization.charts c_course
			   ON  c_course.entity_code        = f.course_id
			   AND c_course.academic_period_id = f.academic_period_id
			   AND c_course.is_active          = true
			 JOIN organization.charts c_sub     ON c_sub.id     = c_course.root_chart_id
			 JOIN organization.charts c_area    ON c_area.id    = c_sub.root_chart_id
			 JOIN organization.charts c_program ON c_program.id = c_area.root_chart_id
			 JOIN organization.charts c_school  ON c_school.id  = c_program.root_chart_id
			 JOIN core.types ct_sch             ON ct_sch.id    = c_school.entity_type_id
			 WHERE f.id              = $1
			   AND ct_sch.code       = $2
			   AND c_school.entity_code = $3
			 LIMIT 1`,
			[findingId, TYPE_CODES.ENTITY_TYPE.SCHOOL, schoolId],
		);
		if (rows.length === 0) {
			throw new HttpException(
				{
					message: ifcFindingsValidationStrings.result.patchFailed,
					errors: [ifcFindingsValidationStrings.error.notFound],
				},
				HttpStatus.NOT_FOUND,
			);
		}
	}
}

const LIST_SQL = `
WITH course_ids AS (
	SELECT DISTINCT entity_code AS course_id
	FROM organization.charts
	WHERE id = ANY($1::int[])
	  AND is_active = true
	  AND entity_code IS NOT NULL
),
school_check AS (
	SELECT 1
	WHERE NOT EXISTS (
		SELECT 1
		FROM organization.charts c0
		WHERE c0.id = ANY($1::int[])
		  AND NOT EXISTS (
			  SELECT 1
			  FROM organization.charts c_sub
			  JOIN organization.charts c_area    ON c_area.id    = c_sub.root_chart_id
			  JOIN organization.charts c_program ON c_program.id = c_area.root_chart_id
			  JOIN organization.charts c_school  ON c_school.id  = c_program.root_chart_id
			  JOIN core.types ct_sch             ON ct_sch.id    = c_school.entity_type_id
			  WHERE c_sub.id            = c0.root_chart_id
			    AND ct_sch.code         = $5
			    AND c_school.entity_code = $3
		  )
	)
)
SELECT
	f.id::int                                                   AS "id",
	ifc_f.ifc_id::int                                           AS "ifcId",
	f.course_id::int                                            AS "courseId",
	ct_crit.code                                                AS "criticalityCode",
	ct_crit.name                                                AS "criticalityName",
	(ct_crit.extra->>'color')                                   AS "criticalityColor",
	(ct_crit.extra->>'order')::int                              AS "criticalityOrder",
	(p_fnd.value #>> '{}')
		|| '-' || inst.code
		|| CASE WHEN ac.code IS NOT NULL THEN '-' || ac.code ELSE '' END
		|| '-' || f.correlative::text                           AS "findingCode",
	ap.code                                                     AS "academicPeriodCode",
	f.description                                               AS "description"
FROM improvement.findings f
JOIN ifc.ifc_findings ifc_f         ON ifc_f.finding_id = f.id
JOIN core.types ct_crit             ON ct_crit.id = f.criticality_type_id
JOIN evidence.instruments inst      ON inst.id    = f.instrument_id
LEFT JOIN academic.courses ac       ON ac.id      = f.course_id
JOIN academic.academic_periods ap   ON ap.id      = f.academic_period_id
CROSS JOIN (SELECT value FROM core.parameters WHERE code = $4) p_fnd
WHERE f.course_id          = ANY (SELECT course_id FROM course_ids)
  AND f.academic_period_id = $2
  AND f.is_active          = true
  AND EXISTS (SELECT 1 FROM school_check)
ORDER BY (ct_crit.extra->>'order')::int ASC, f.correlative ASC
`;

const FINDING_HEADER_SQL = `
WITH school_check AS (
	SELECT 1
	FROM improvement.findings f
	JOIN organization.charts c_course
	  ON  c_course.entity_code        = f.course_id
	  AND c_course.academic_period_id = f.academic_period_id
	  AND c_course.is_active          = true
	JOIN organization.charts c_sub     ON c_sub.id     = c_course.root_chart_id
	JOIN organization.charts c_area    ON c_area.id    = c_sub.root_chart_id
	JOIN organization.charts c_program ON c_program.id = c_area.root_chart_id
	JOIN organization.charts c_school  ON c_school.id  = c_program.root_chart_id
	JOIN core.types ct_sch             ON ct_sch.id    = c_school.entity_type_id
	WHERE f.id = $1
	  AND ct_sch.code = $4
	  AND c_school.entity_code = $2
)
SELECT
	f.id::int                                                AS "id",
	(p_fnd.value #>> '{}')
		|| '-' || inst.code
		|| CASE WHEN ac.code IS NOT NULL THEN '-' || ac.code ELSE '' END
		|| '-' || f.correlative::text                        AS "findingCode",
	ap.code                                                  AS "academicPeriodCode",
	f.description                                            AS "description",
	ct_crit.code                                             AS "criticalityCode",
	ct_crit.name                                             AS "criticalityName",
	(ct_crit.extra->>'color')                                AS "criticalityColor"
FROM improvement.findings f
JOIN core.types ct_crit             ON ct_crit.id = f.criticality_type_id
JOIN evidence.instruments inst      ON inst.id    = f.instrument_id
LEFT JOIN academic.courses ac       ON ac.id      = f.course_id
JOIN academic.academic_periods ap   ON ap.id      = f.academic_period_id
CROSS JOIN (SELECT value FROM core.parameters WHERE code = $3) p_fnd
WHERE f.id        = $1
  AND f.is_active = true
  AND EXISTS (SELECT 1 FROM school_check)
`;

const FINDING_ACTIONS_SQL = `
SELECT
	a.id::int                                                AS "id",
	(p_acn.value #>> '{}')
		|| '-' || inst.code
		|| CASE WHEN ac.code IS NOT NULL THEN '-' || ac.code ELSE '' END
		|| '-' || a.correlative::text                        AS "actionCode",
	a.description                                            AS "description",
	CASE WHEN fa.evidences IS NULL THEN $3 ELSE $4 END       AS "completenessCode",
	comp.name                                                AS "completenessName",
	(comp.extra->>'color')                                   AS "completenessColor"
FROM improvement.finding_actions fa
JOIN improvement.actions  a      ON a.id    = fa.action_id
JOIN improvement.findings f      ON f.id    = fa.finding_id
JOIN evidence.instruments inst   ON inst.id = f.instrument_id
LEFT JOIN academic.courses ac    ON ac.id   = f.course_id
CROSS JOIN (SELECT value FROM core.parameters WHERE code = $2) p_acn
LEFT JOIN core.types comp        ON comp.code = (CASE WHEN fa.evidences IS NULL THEN $3 ELSE $4 END)
WHERE fa.finding_id = $1
  AND a.is_active   = true
ORDER BY a.correlative ASC
`;
