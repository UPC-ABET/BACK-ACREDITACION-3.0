import { HttpException, HttpStatus } from '@nestjs/common';
import { RoleRepository } from './roles.repository';
import { rolesValidationStrings } from '../config/strings/roles.validation';

export class RoleValidation {
	static async validateCreate(repo: RoleRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({ where: { code: data.code } });
		if (exists) errors.push(rolesValidationStrings.error.codeExists);

		if (errors.length > 0) {
			throw new HttpException(
				{ message: rolesValidationStrings.result.createFailed, errors },
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: RoleRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(rolesValidationStrings.error.notFound);

		if (data.code) {
			const exists = await repo.findOneByCondition({ where: { code: data.code } });
			if (exists && exists.id !== id) errors.push(rolesValidationStrings.error.codeExists);
		}

		if (errors.length > 0) {
			throw new HttpException(
				{ message: rolesValidationStrings.result.updateFailed, errors },
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: RoleRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{ message: rolesValidationStrings.result.deleteFailed },
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
