import { HttpException, HttpStatus } from '@nestjs/common';
import { FindingRepository } from './findings.repository';
import { findingsValidationStrings } from '../config/strings/findings.validation';

export class FindingValidation {
	static async validateCreate(repo: FindingRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				instrumentId: data.instrumentId,
				correlative: data.correlative,
				courseId: data.courseId,
				campusId: data.campusId,
			},
		});

		if (exists) errors.push(findingsValidationStrings.error.findingExists);

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: findingsValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: FindingRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(findingsValidationStrings.error.notFound);

		const instrumentId = data.instrumentId ?? entity?.instrumentId;
		const correlative = data.correlative ?? entity?.correlative;
		const studyPlanCourseId = data.courseId ?? entity?.courseId;
		const campusId = data.campusId ?? entity?.campusId;

		const exists = await repo.findOneByCondition({
			where: {
				instrumentId: instrumentId,
				correlative,
				courseId: studyPlanCourseId,
				campusId: campusId,
			},
		});

		if (exists && exists.id !== id) {
			errors.push(findingsValidationStrings.error.findingExists);
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: findingsValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: FindingRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: findingsValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
