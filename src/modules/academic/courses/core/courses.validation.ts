import { HttpException, HttpStatus } from '@nestjs/common';
import { CourseRepository } from './courses.repository';
import { coursesValidationStrings } from '../config/strings/courses.validation';

export class CourseValidation {
	static async validateCreate(repo: CourseRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: { name: data.name },
		});

		if (exists) errors.push(coursesValidationStrings.error.nameExists);

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: coursesValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: CourseRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(coursesValidationStrings.error.notFound);

		if (data.name) {
			const exists = await repo.findOneByCondition({
				where: { name: data.name },
			});

			if (exists && exists.id !== id) {
				errors.push(coursesValidationStrings.error.nameExists);
			}
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: coursesValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: CourseRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: coursesValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
