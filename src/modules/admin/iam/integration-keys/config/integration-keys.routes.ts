export const integrationKeysRoutes = {
	route: 'admin-iam-integration-keys',
	tag: 'IAM - Integration Keys',
	operation: {
		issue: { method: 'POST', route: '/issue', summary: 'Emitir clave de cifrado de integración' },
		rotate: {
			method: 'POST',
			route: '/rotate/:apiTokenId',
			summary: 'Rotar clave de cifrado de integración',
		},
		getByApiToken: {
			method: 'GET',
			route: '/get-by-api-token/:apiTokenId',
			summary: 'Obtener metadata de la clave de una integración',
		},
		getAll: { method: 'GET', route: '/get-all', summary: 'Listar claves de integración' },
	},
};
