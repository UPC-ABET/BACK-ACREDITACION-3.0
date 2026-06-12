import { HttpException, HttpStatus } from '@nestjs/common';
import { OutcomeRepository, OutcomeDeleteBlockerCounts } from './outcomes.repository';
import { outcomesValidationStrings } from '../config/strings/outcomes.validation';
import { UpdateOutcomeMaintenanceDto } from '../model/outcomes.dtos';

const DELETE_BLOCKER_KEYS: Array<[keyof OutcomeDeleteBlockerCounts, string]> = [
	['courseOutcomeMappings', outcomesValidationStrings.error.usedInCourseOutcomeMappings],
	['rubricQuestions', outcomesValidationStrings.error.usedInRubricQuestions],
	['studentCourseOutcomeGrades', outcomesValidationStrings.error.usedInStudentCourseOutcomeGrades],
	['findingOutcomes', outcomesValidationStrings.error.usedInFindingOutcomes],
	['outcomeConfigs', outcomesValidationStrings.error.usedInOutcomeConfigs],
	['scores', outcomesValidationStrings.error.usedInScores],
];

export class OutcomeValidation {
	static async validateCreate(repo: OutcomeRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				programCommissionId: data.programCommissionId,
				outcomeCode: data.outcomeCode,
			},
		});

		if (exists) errors.push(outcomesValidationStrings.error.outcomeCodeExists);

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: outcomesValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: OutcomeRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(outcomesValidationStrings.error.notFound);

		if (data.programCommissionId && data.outcomeCode) {
			const exists = await repo.findOneByCondition({
				where: {
					programCommissionId: data.programCommissionId,
					outcomeCode: data.outcomeCode,
				},
			});

			if (exists && exists.id !== id) {
				errors.push(outcomesValidationStrings.error.outcomeCodeExists);
			}
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: outcomesValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: OutcomeRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: outcomesValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateMaintenanceUpdate(
		repo: OutcomeRepository,
		id: number,
		data: UpdateOutcomeMaintenanceDto,
	) {
		const entity = await repo.findOneById(id);
		if (!entity) {
			throw new HttpException(
				{
					message: outcomesValidationStrings.result.updateFailed,
					errors: [outcomesValidationStrings.error.notFound],
				},
				HttpStatus.NOT_FOUND,
			);
		}

		const errors: Array<string> = [];

		if (data.outcomeCode !== undefined && data.outcomeCode !== entity.outcomeCode) {
			const codeOwner = await repo.findOneByCondition({
				where: {
					programCommissionId: entity.programCommissionId,
					outcomeCode: data.outcomeCode,
				},
			});
			if (codeOwner && codeOwner.id !== id) {
				errors.push(outcomesValidationStrings.error.outcomeCodeExists);
			}
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: outcomesValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateMaintenanceDelete(repo: OutcomeRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: outcomesValidationStrings.result.deleteFailed,
					errors: [outcomesValidationStrings.error.notFound],
				},
				HttpStatus.NOT_FOUND,
			);
		}

		const counts = await repo.findDeleteBlockerCounts(id);
		const blockers = DELETE_BLOCKER_KEYS.filter(([key]) => counts[key] > 0).map(([, msg]) => msg);

		if (blockers.length > 0) {
			throw new HttpException(
				{
					message: outcomesValidationStrings.error.inUse,
					errors: blockers,
				},
				HttpStatus.CONFLICT,
			);
		}
	}
}
