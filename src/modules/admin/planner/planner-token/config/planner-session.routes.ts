export const plannerSessionRoutes = {
	session: {
		route: 'planner/session',
		tag: 'Planner Session',
		operation: {
			status: { method: 'GET', route: '/status', summary: 'Planner session / token health' },
			refresh: {
				method: 'POST',
				route: '/refresh',
				summary: 'Force a Planner token refresh (validate API, or headless login if needed)',
			},
		},
	},
};
