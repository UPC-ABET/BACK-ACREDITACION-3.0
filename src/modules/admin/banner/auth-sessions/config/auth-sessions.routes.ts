export const authSessionsRoutes = {
	sessions: {
		route: 'banner/auth/sessions',
		tag: 'Banner Auth',
		operation: {
			create: { method: 'POST', route: '', summary: 'Start a Banner login session (Option C)' },
			get: { method: 'GET', route: '/:id', summary: 'Get login session status' },
			delete: { method: 'DELETE', route: '/:id', summary: 'Cancel / tear down a login session' },
		},
	},
};
