import { HttpException, HttpStatus } from '@nestjs/common';
import { StudentRepository } from './students.repository';
import { studentsValidationStrings } from '../config/strings/students.validation';

export class StudentValidation {
	static async validateCreate(repo: StudentRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				email: data.email,
			},
		});

		if (exists) errors.push(studentsValidationStrings.error.studentExists);

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: studentsValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: StudentRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(studentsValidationStrings.error.notFound);

		if (data.email) {
			const exists = await repo.findOneByCondition({
				where: {
					email: data.email,
				},
			});

			if (exists && exists.id !== id) {
				errors.push(studentsValidationStrings.error.studentExists);
			}
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: studentsValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: StudentRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: studentsValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
