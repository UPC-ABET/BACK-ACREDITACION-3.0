/**
 * Stable role codes seeded in `core.roles`. Single source of truth so authorization
 * logic never compares against a hand-written role string.
 */
export const ROLE_CODES = {
	ADMIN: 'ADMIN',
	IFC: 'IFC',
} as const;

export type RoleCode = (typeof ROLE_CODES)[keyof typeof ROLE_CODES];
