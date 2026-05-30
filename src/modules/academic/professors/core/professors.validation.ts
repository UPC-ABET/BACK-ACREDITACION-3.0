import { HttpException, HttpStatus } from '@nestjs/common';
import { ProfessorRepository } from './professors.repository';
import { professorsValidationStrings } from '../config/strings/professors.validation';

export class ProfessorValidation {
	static async validateCreate(repo: ProfessorRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				staffId: data.staffId,
			},
		});

		if (exists) errors.push(professorsValidationStrings.error.staffExists);

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: professorsValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: ProfessorRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(professorsValidationStrings.error.notFound);

		if (data.staffId) {
			const exists = await repo.findOneByCondition({
				where: {
					staffId: data.staffId,
				},
			});

			if (exists && exists.id !== id) {
				errors.push(professorsValidationStrings.error.staffExists);
			}
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: professorsValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: ProfessorRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: professorsValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
