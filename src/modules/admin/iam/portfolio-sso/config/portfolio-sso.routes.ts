export const portfolioSsoRoutes = {
	route: 'admin-iam-portfolio-sso',
	tag: 'IAM - Portfolio SSO',
	operation: {
		getConfig: {
			method: 'GET',
			route: '/config',
			summary: 'Obtener configuración de SSO Portfolio',
		},
		upsertConfig: {
			method: 'PUT',
			route: '/config',
			summary: 'Actualizar configuración de SSO Portfolio',
		},
		getLink: { method: 'GET', route: '/link', summary: 'Obtener enlace de SSO a Portfolio' },
	},
};
