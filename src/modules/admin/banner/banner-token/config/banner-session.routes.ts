export const bannerSessionRoutes = {
	session: {
		route: 'banner/session',
		tag: 'Banner Session',
		operation: {
			status: { method: 'GET', route: '/status', summary: 'Banner session / token health' },
		},
	},
};
