export type LocalizedName = {
	en?: string;
	es?: string;
};

export type AuthorizationRole = {
	id: number;
	code?: string;
	name: LocalizedName;
};

export type AuthorizationPermission = {
	id: number;
	code: string;
	module: string;
	route: string;
	permissions: string[];
};

export type AuthorizationProfile = {
	roles: AuthorizationRole[];
	permissions: AuthorizationPermission[];
};

export type RequestUser = {
	userId: number;
} & AuthorizationProfile;

/** A single `{module, action}` grant recorded on an API token at issuance. */
export type ApiTokenScope = {
	module: string;
	action: string;
};

/** The shape `PermissionsGuard` already iterates for a human caller's permissions. */
export type MachinePermission = Pick<AuthorizationPermission, 'module' | 'permissions'>;

/**
 * A machine principal resolved from a valid `X-Api-Key`. Distinct from `RequestUser` by
 * construction: no `userId`, no `roles`, so `isAdmin()` and `@CurrentUser()` can never receive one.
 */
export type ApiTokenPrincipal = {
	apiTokenId: number;
	keyId: string;
	name: string;
	permissions: MachinePermission[];
};
