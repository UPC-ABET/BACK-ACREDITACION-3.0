import { BadRequestError, ConflictError, NotFoundError } from 'src/commons/domain-error';
import { OutcomeRepository, OutcomeDeleteBlockerCounts } from './outcomes.repository';
import { outcomesValidationStrings } from '../config/strings/outcomes.validation';
import { UpdateOutcomeMaintenanceDto, CreateOutcomeMaintenanceDto } from '../model/outcomes.dtos';

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
			throw new BadRequestError({
				message: outcomesValidationStrings.result.createFailed,
				errors,
			});
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
			throw new BadRequestError({
				message: outcomesValidationStrings.result.updateFailed,
				errors,
			});
		}
	}

	static async validateDelete(repo: OutcomeRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new BadRequestError({
				message: outcomesValidationStrings.result.deleteFailed,
			});
		}
	}

	static async validateMaintenanceCreate(
		repo: OutcomeRepository,
		programCommissionId: number | null,
		data: CreateOutcomeMaintenanceDto,
	) {
		const errors: Array<string> = [];

		if (!programCommissionId) {
			errors.push(outcomesValidationStrings.error.programCommissionNotFound);
		} else {
			const codeOwner = await repo.findOneByCondition({
				where: { programCommissionId, outcomeCode: data.outcomeCode },
			});
			if (codeOwner) errors.push(outcomesValidationStrings.error.outcomeCodeExists);
		}

		if (errors.length > 0) {
			throw new BadRequestError({ message: outcomesValidationStrings.result.createFailed, errors });
		}
	}

	static async validateMaintenanceUpdate(
		repo: OutcomeRepository,
		id: number,
		data: UpdateOutcomeMaintenanceDto,
	) {
		const entity = await repo.findOneById(id);
		if (!entity) {
			throw new NotFoundError({
				message: outcomesValidationStrings.result.updateFailed,
				errors: [outcomesValidationStrings.error.notFound],
			});
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
			throw new BadRequestError({
				message: outcomesValidationStrings.result.updateFailed,
				errors,
			});
		}
	}

	static async validateMaintenanceDelete(repo: OutcomeRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new NotFoundError({
				message: outcomesValidationStrings.result.deleteFailed,
				errors: [outcomesValidationStrings.error.notFound],
			});
		}

		const counts = await repo.findDeleteBlockerCounts(id);
		const blockers = DELETE_BLOCKER_KEYS.filter(([key]) => counts[key] > 0).map(([, msg]) => msg);

		if (blockers.length > 0) {
			throw new ConflictError({
				message: outcomesValidationStrings.error.inUse,
				errors: blockers,
			});
		}
	}
}
