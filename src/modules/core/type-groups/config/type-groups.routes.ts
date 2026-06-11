export const typeGroupsRoutes = {
	typeGroups: {
		route: 'type-groups',
		tag: 'Grupos de tipos',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar grupo de tipos' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar grupo de tipos' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar grupo de tipos' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar grupos de tipos' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener grupo de tipos' },
			getByFilters: { method: 'POST', route: '/get-by-filters', summary: 'Buscar grupos de tipos' },
		},
	},
};
