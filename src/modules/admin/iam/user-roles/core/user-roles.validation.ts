import { HttpException, HttpStatus } from '@nestjs/common';
import { UserRoleRepository } from './user-roles.repository';
import { userRolesValidationStrings } from '../config/strings/user-roles.validation';

export class UserRoleValidation {
	static async validateCreate(repo: UserRoleRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: { userId: data.userId, roleId: data.roleId },
		});
		if (exists) errors.push(userRolesValidationStrings.error.alreadyAssigned);

		if (errors.length > 0) {
			throw new HttpException(
				{ message: userRolesValidationStrings.result.createFailed, errors },
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: UserRoleRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(userRolesValidationStrings.error.notFound);

		const userId = data.userId ?? entity?.userId;
		const roleId = data.roleId ?? entity?.roleId;
		if (entity && (data.userId || data.roleId)) {
			const exists = await repo.findOneByCondition({ where: { userId, roleId } });
			if (exists && exists.id !== id) {
				errors.push(userRolesValidationStrings.error.alreadyAssigned);
			}
		}

		if (errors.length > 0) {
			throw new HttpException(
				{ message: userRolesValidationStrings.result.updateFailed, errors },
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: UserRoleRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{ message: userRolesValidationStrings.result.deleteFailed },
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
