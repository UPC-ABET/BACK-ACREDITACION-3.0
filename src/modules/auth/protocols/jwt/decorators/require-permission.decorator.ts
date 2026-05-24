import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PERMISSION_KEY = 'requiredPermission';

export type RequiredPermission = {
	module: string;
	action: string;
};

export const RequirePermission = (permission: RequiredPermission) =>
	SetMetadata(REQUIRED_PERMISSION_KEY, {
		module: permission.module.toUpperCase(),
		action: permission.action.toUpperCase(),
	} satisfies RequiredPermission);
