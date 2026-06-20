import { ROLE_CODES } from 'src/shared/constants/role-codes';
import { RequestUser } from './authorization.types';

export const isAdminRole = (role?: { code?: string } | null): boolean =>
	role?.code?.toUpperCase() === ROLE_CODES.ADMIN;

export const isAdmin = (user?: Pick<RequestUser, 'roles'> | null): boolean =>
	(user?.roles ?? []).some(isAdminRole);
