export const plannerSessionRoutes = {
	session: {
		route: 'planner/session',
		tag: 'Planner Session',
		operation: {
			status: { method: 'GET', route: '/status', summary: 'Planner session / token health' },
			refresh: {
				method: 'POST',
				route: '/refresh',
				summary: 'Force a Planner token refresh (re-runs the u-planner API login)',
			},
			getCredentials: {
				method: 'GET',
				route: '/credentials',
				summary: 'Configured Planner credentials (username only, never the password)',
			},
			saveCredentials: {
				method: 'POST',
				route: '/credentials',
				summary: 'Set the Planner credentials; verified against u-planner before being stored',
			},
		},
	},
};
