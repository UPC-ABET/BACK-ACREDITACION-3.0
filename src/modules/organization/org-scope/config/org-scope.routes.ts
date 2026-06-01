export const orgScopeRoutes = {
	orgScope: {
		route: 'org-scope',
		tag: 'Organigrama — Alcance del usuario',
		operation: {
			getScope: {
				method: 'POST',
				route: '/get-scope',
				summary: 'Obtener el árbol de alcance del usuario para un período académico',
			},
			getUserSchools: {
				method: 'POST',
				route: '/get-user-schools',
				summary: 'List schools assigned to the current user for an academic period',
			},
		},
	},
};
