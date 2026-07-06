export const projectGroupsRoutes = {
	projectGroups: {
		route: 'project-groups',
		tag: 'Grupos de proyecto',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar grupo de proyecto' },
			update: { method: 'PATCH', route: '/update/:id', summary: 'Actualizar grupo de proyecto' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar grupo de proyecto' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar grupos de proyecto' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener grupo de proyecto' },
			getByFilters: {
				method: 'POST',
				route: '/get-by-filters',
				summary: 'Buscar grupos de proyecto',
			},
		},
	},
};
