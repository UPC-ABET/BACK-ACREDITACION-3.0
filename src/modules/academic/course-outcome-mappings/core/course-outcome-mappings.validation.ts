import { HttpException, HttpStatus } from '@nestjs/common';
import { CourseOutcomeMappingRepository } from './course-outcome-mappings.repository';
import { BulkSaveCourseOutcomeMappingDto } from '../model/course-outcome-mappings.dtos';
import { courseOutcomeMappingsValidationStrings } from '../config/strings/course-outcome-mappings.validation';

export class CourseOutcomeMappingValidation {
	static async validateCreate(repo: CourseOutcomeMappingRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				outcomeId: data.outcomeId,
				studyPlanCourseId: data.studyPlanCourseId,
			},
		});

		if (exists) errors.push(courseOutcomeMappingsValidationStrings.error.mappingExists);

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: courseOutcomeMappingsValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: CourseOutcomeMappingRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(courseOutcomeMappingsValidationStrings.error.notFound);

		if (data.outcomeId && data.studyPlanCourseId) {
			const exists = await repo.findOneByCondition({
				where: {
					outcomeId: data.outcomeId,
					studyPlanCourseId: data.studyPlanCourseId,
				},
			});

			if (exists && exists.id !== id) {
				errors.push(courseOutcomeMappingsValidationStrings.error.mappingExists);
			}
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: courseOutcomeMappingsValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: CourseOutcomeMappingRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: courseOutcomeMappingsValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateBulkSave(
		repo: CourseOutcomeMappingRepository,
		data: BulkSaveCourseOutcomeMappingDto,
	) {
		const errors: Array<string> = [];

		const scope = await repo.getProgramCommissionScope(data.programCommissionId);
		if (!scope) {
			throw new HttpException(
				{
					message: courseOutcomeMappingsValidationStrings.result.bulkSaveFailed,
					errors: [courseOutcomeMappingsValidationStrings.error.programCommissionNotFound],
				},
				HttpStatus.BAD_REQUEST,
			);
		}

		const [scopedCourseIds, scopedOutcomeIds, assignableTypeIds] = await Promise.all([
			repo.getStudyPlanCourseIdsInScope(scope),
			repo.getOutcomeIdsForProgramCommission(data.programCommissionId),
			repo.getAssignableOutcomeTypeIds(),
		]);

		const courseScope = new Set(scopedCourseIds);
		const outcomeScope = new Set(scopedOutcomeIds);
		const typeScope = new Set(assignableTypeIds);

		let courseOutOfScope = false;
		let outcomeOutOfScope = false;
		let invalidOutcomeType = false;
		let duplicateCourseOutcome = false;

		for (const course of data.courses) {
			if (!courseScope.has(course.studyPlanCourseId)) courseOutOfScope = true;

			const seenOutcomes = new Set<number>();
			for (const outcome of course.outcomes) {
				if (!outcomeScope.has(outcome.outcomeId)) outcomeOutOfScope = true;
				if (!typeScope.has(outcome.outcomeTypeId)) invalidOutcomeType = true;
				if (seenOutcomes.has(outcome.outcomeId)) duplicateCourseOutcome = true;
				seenOutcomes.add(outcome.outcomeId);
			}
		}

		if (courseOutOfScope)
			errors.push(courseOutcomeMappingsValidationStrings.error.courseOutOfScope);
		if (outcomeOutOfScope)
			errors.push(courseOutcomeMappingsValidationStrings.error.outcomeOutOfScope);
		if (invalidOutcomeType)
			errors.push(courseOutcomeMappingsValidationStrings.error.invalidOutcomeType);
		if (duplicateCourseOutcome)
			errors.push(courseOutcomeMappingsValidationStrings.error.duplicateCourseOutcome);

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: courseOutcomeMappingsValidationStrings.result.bulkSaveFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
