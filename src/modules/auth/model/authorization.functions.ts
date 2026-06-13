import { ROLE_CODES } from 'src/shared/constants/role-codes';
import { RequestUser } from './authorization.types';

export const isAdminRole = (activeRole?: { code?: string } | null): boolean =>
	activeRole?.code?.toUpperCase() === ROLE_CODES.ADMIN;

export const isAdmin = (user: RequestUser): boolean => isAdminRole(user.activeRole);
