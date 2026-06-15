export const bannerSessionRoutes = {
	session: {
		route: 'banner/session',
		tag: 'Banner Session',
		operation: {
			status: { method: 'GET', route: '/status', summary: 'Banner session / token health' },
			refresh: {
				method: 'POST',
				route: '/refresh',
				summary: 'Force a headless token refresh from auth_state.json',
			},
		},
	},
};
