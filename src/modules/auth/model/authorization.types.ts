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
	activeRole: AuthorizationRole;
	allowedRoles: AuthorizationRole[];
	permissions: AuthorizationPermission[];
};
