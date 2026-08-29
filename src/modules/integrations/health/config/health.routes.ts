export const integrationsHealthRoutes = {
	route: 'integrations/health',
	tag: 'Integrations - Health',
	operation: {
		ping: {
			method: 'GET',
			route: '/ping',
			summary: 'Health check for external integration callers',
		},
	},
};
