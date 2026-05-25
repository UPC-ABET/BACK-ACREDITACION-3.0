import { HttpException, HttpStatus } from '@nestjs/common';
import { FindingRepository } from './findings.repository';
import { findingsValidationStrings } from '../config/strings/findings.validation';

export class FindingValidation {
	static async validateCreate(repo: FindingRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				instrument_id: data.instrument_id,
				correlative: data.correlative,
				course_id: data.course_id,
				campus_id: data.campus_id,
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

		const instrumentId = data.instrument_id ?? entity?.instrument_id;
		const correlative = data.correlative ?? entity?.correlative;
		const studyPlanCourseId = data.course_id ?? entity?.course_id;
		const campusId = data.campus_id ?? entity?.campus_id;

		const exists = await repo.findOneByCondition({
			where: {
				instrument_id: instrumentId,
				correlative,
				course_id: studyPlanCourseId,
				campus_id: campusId,
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
