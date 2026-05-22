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
		},
	},
};
