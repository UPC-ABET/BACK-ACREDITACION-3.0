/**
 * Permission module codes used by `@RequirePermission({ module, action })`.
 *
 * These mirror the `TG2001` (URL module) type codes seeded in `core.types`
 * (see the auth roles/permissions seed). Single source of truth so controllers
 * never hand-write the raw module string.
 */
export const PERMISSION_MODULES = {
	HOME: 'HOME',
	ADMIN: 'ADMIN',
	USERS: 'USERS',
	CORE: 'CORE',
	ACADEMIC: 'ACADEMIC',
	ACCREDITATION: 'ACCREDITATION',
	EVALUATION: 'EVALUATION',
	EVIDENCE: 'EVIDENCE',
	IMPROVEMENT: 'IMPROVEMENT',
	ORGANIZATION: 'ORGANIZATION',
	SURVEY: 'SURVEY',
	IFCS: 'IFCS',
	IFC_FINDINGS: 'IFC_FINDINGS',
	RUBRICS: 'RUBRICS',
	TESTS: 'TESTS',
	LOADS: 'LOADS',
	PORTFOLIO: 'PORTFOLIO',
	SCRAPPING: 'SCRAPPING',
} as const;

export type PermissionModule = (typeof PERMISSION_MODULES)[keyof typeof PERMISSION_MODULES];

/**
 * Permission actions used by `@RequirePermission({ module, action })`.
 *
 * These mirror the `TG2000` (permission) type names seeded in `core.types`
 * and the HTTP verbs the `PermissionsGuard` matches against.
 */
export const PERMISSION_ACTIONS = {
	GET: 'GET',
	POST: 'POST',
	PUT: 'PUT',
	DELETE: 'DELETE',
	PATCH: 'PATCH',
} as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[keyof typeof PERMISSION_ACTIONS];
