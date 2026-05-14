import { HttpException, HttpStatus } from '@nestjs/common';
import { SchoolRepository } from './schools.repository';
import { schoolsValidationStrings } from '../config/strings/schools.validation';

export class SchoolValidation {
	static async validateCreate(repo: SchoolRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				faculty_id: data.faculty_id,
				code: data.code,
			},
		});

		if (exists) errors.push(schoolsValidationStrings.error.codeExists);

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: schoolsValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: SchoolRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(schoolsValidationStrings.error.notFound);

		if (data.faculty_id && data.code) {
			const exists = await repo.findOneByCondition({
				where: {
					faculty_id: data.faculty_id,
					code: data.code,
				},
			});

			if (exists && exists.id !== id) {
				errors.push(schoolsValidationStrings.error.codeExists);
			}
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: schoolsValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: SchoolRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: schoolsValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
