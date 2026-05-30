import { HttpException, HttpStatus } from '@nestjs/common';
import { StudyPlanRepository } from './study-plans.repository';
import { studyPlansValidationStrings } from '../config/strings/study-plans.validation';

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
			throw new HttpException(
				{
					message: studyPlansValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
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
			throw new HttpException(
				{
					message: studyPlansValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: StudyPlanRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: studyPlansValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
