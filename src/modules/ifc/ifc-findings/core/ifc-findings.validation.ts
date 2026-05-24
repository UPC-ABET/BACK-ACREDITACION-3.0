import { HttpException, HttpStatus } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { IfcFindingRepository } from './ifc-findings.repository';
import { ifcFindingsValidationStrings } from '../config/strings/ifc-findings.validation';

export class IfcFindingValidation {
	static async validateCreate(repo: IfcFindingRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				ifc_id: data.ifc_id,
				finding_id: data.finding_id,
			},
		});

		if (exists) errors.push(ifcFindingsValidationStrings.error.relationExists);

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: ifcFindingsValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: IfcFindingRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(ifcFindingsValidationStrings.error.notFound);

		const ifcId = data.ifc_id ?? entity?.ifc_id;
		const findingId = data.finding_id ?? entity?.finding_id;

		const exists = await repo.findOneByCondition({
			where: {
				ifc_id: ifcId,
				finding_id: findingId,
			},
		});

		if (exists && exists.id !== id) {
			errors.push(ifcFindingsValidationStrings.error.relationExists);
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: ifcFindingsValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: IfcFindingRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: ifcFindingsValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async assertFindingExists(em: EntityManager, id: number) {
		const rows = await em.query(
			'SELECT id, course_id::int AS course_id, academic_period_id::int AS academic_period_id FROM improvement.findings WHERE id = $1 LIMIT 1',
			[id],
		);
		if (rows.length === 0) {
			throw new HttpException(
				{
					message: ifcFindingsValidationStrings.result.deleteFailed,
					errors: [ifcFindingsValidationStrings.error.notFound],
				},
				HttpStatus.NOT_FOUND,
			);
		}
		return rows[0];
	}

	static async resolveCourseChart(
		em: EntityManager,
		courseId: number,
		periodId: number,
		courseLevelCode: string,
	) {
		const rows = await em.query(
			`SELECT c.id::int AS id, c.staff_id::int AS staff_id
			 FROM organization.charts c
			 JOIN organization.chart_levels cl ON cl.id = c.chart_level_id
			 JOIN core.types ct                ON ct.id = cl.level_type_id
			 WHERE c.entity_code        = $1
			   AND c.academic_period_id = $2
			   AND ct.code              = $3
			   AND c.is_active          = true
			 LIMIT 1`,
			[courseId, periodId, courseLevelCode],
		);
		if (rows.length === 0) {
			throw new HttpException(
				{
					message: ifcFindingsValidationStrings.result.deleteFailed,
					errors: [ifcFindingsValidationStrings.error.courseChartNotFound],
				},
				HttpStatus.NOT_FOUND,
			);
		}
		return rows[0];
	}
}
