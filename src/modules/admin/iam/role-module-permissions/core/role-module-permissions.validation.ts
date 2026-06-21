import { BadRequestError } from 'src/commons/domain-error';
import { RoleModulePermissionRepository } from './role-module-permissions.repository';
import { roleModulePermissionsValidationStrings } from '../config/strings/role-module-permissions.validation';

export class RoleModulePermissionValidation {
	static async validateCreate(repo: RoleModulePermissionRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				roleId: data.roleId,
				moduleTypeId: data.moduleTypeId,
				permissionTypeId: data.permissionTypeId,
			},
		});
		if (exists) errors.push(roleModulePermissionsValidationStrings.error.alreadyAssigned);

		if (errors.length > 0) {
			throw new BadRequestError({
				message: roleModulePermissionsValidationStrings.result.createFailed,
				errors,
			});
		}
	}

	static async validateUpdate(repo: RoleModulePermissionRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(roleModulePermissionsValidationStrings.error.notFound);

		if (entity && (data.roleId || data.moduleTypeId || data.permissionTypeId)) {
			const exists = await repo.findOneByCondition({
				where: {
					roleId: data.roleId ?? entity.roleId,
					moduleTypeId: data.moduleTypeId ?? entity.moduleTypeId,
					permissionTypeId: data.permissionTypeId ?? entity.permissionTypeId,
				},
			});
			if (exists && exists.id !== id) {
				errors.push(roleModulePermissionsValidationStrings.error.alreadyAssigned);
			}
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: roleModulePermissionsValidationStrings.result.updateFailed,
				errors,
			});
		}
	}

	static async validateDelete(repo: RoleModulePermissionRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new BadRequestError({
				message: roleModulePermissionsValidationStrings.result.deleteFailed,
			});
		}
	}
}
