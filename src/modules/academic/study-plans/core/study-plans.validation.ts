import { BadRequestError, ConflictError, NotFoundError } from 'src/commons/domain-error';
import { StudyPlanRepository, StudyPlanDeleteBlockerCounts } from './study-plans.repository';
import { studyPlansValidationStrings } from '../config/strings/study-plans.validation';
import {
	UpdateStudyPlanMaintenanceDto,
	CreateStudyPlanMaintenanceDto,
} from '../model/study-plans.dtos';

const DELETE_BLOCKER_KEYS: Array<[keyof StudyPlanDeleteBlockerCounts, string]> = [
	['academicPeriods', studyPlansValidationStrings.error.usedInAcademicPeriods],
];

export class StudyPlanValidation {
	static async validateCreate(repo: StudyPlanRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				programId: data.programId,
				code: data.code,
			},
		});

		if (exists) errors.push(studyPlansValidationStrings.error.codeExists);

		if (errors.length > 0) {
			throw new BadRequestError({
				message: studyPlansValidationStrings.result.createFailed,
				errors,
			});
		}
	}

	static async validateUpdate(repo: StudyPlanRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(studyPlansValidationStrings.error.notFound);

		if (data.programId && data.code) {
			const exists = await repo.findOneByCondition({
				where: {
					programId: data.programId,
					code: data.code,
				},
			});

			if (exists && exists.id !== id) {
				errors.push(studyPlansValidationStrings.error.codeExists);
			}
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: studyPlansValidationStrings.result.updateFailed,
				errors,
			});
		}
	}

	static async validateDelete(repo: StudyPlanRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new BadRequestError({
				message: studyPlansValidationStrings.result.deleteFailed,
			});
		}
	}

	static async validateMaintenanceCreate(
		repo: StudyPlanRepository,
		modalityTypeId: number,
		data: CreateStudyPlanMaintenanceDto,
	) {
		const errors: Array<string> = [];

		if (!(await repo.isProgramInModality(data.programId, modalityTypeId))) {
			errors.push(studyPlansValidationStrings.error.programNotInModality);
		}

		const exists = await repo.findOneByCondition({
			where: { programId: data.programId, code: data.code },
		});
		if (exists) errors.push(studyPlansValidationStrings.error.codeExists);

		if (errors.length > 0) {
			throw new BadRequestError({
				message: studyPlansValidationStrings.result.createFailed,
				errors,
			});
		}
	}

	static async validateMaintenanceUpdate(
		repo: StudyPlanRepository,
		id: number,
		data: UpdateStudyPlanMaintenanceDto,
	) {
		const entity = await repo.findOneById(id);
		if (!entity) {
			throw new NotFoundError({
				message: studyPlansValidationStrings.result.updateFailed,
				errors: [studyPlansValidationStrings.error.notFound],
			});
		}

		const programId = data.programId ?? entity.programId;
		const code = data.code ?? entity.code;
		const codeOrProgramChanged =
			(data.code !== undefined && data.code !== entity.code) ||
			(data.programId !== undefined && data.programId !== entity.programId);

		if (codeOrProgramChanged) {
			const exists = await repo.findOneByCondition({ where: { programId, code } });
			if (exists && exists.id !== id) {
				throw new BadRequestError({
					message: studyPlansValidationStrings.result.updateFailed,
					errors: [studyPlansValidationStrings.error.codeExists],
				});
			}
		}
	}

	static async validateMaintenanceDelete(repo: StudyPlanRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new NotFoundError({
				message: studyPlansValidationStrings.result.deleteFailed,
				errors: [studyPlansValidationStrings.error.notFound],
			});
		}

		const counts = await repo.findDeleteBlockerCounts(id);
		const blockers = DELETE_BLOCKER_KEYS.filter(([key]) => counts[key] > 0).map(([, msg]) => msg);

		if (blockers.length > 0) {
			throw new ConflictError({
				message: studyPlansValidationStrings.error.inUse,
				errors: blockers,
			});
		}
	}
}
