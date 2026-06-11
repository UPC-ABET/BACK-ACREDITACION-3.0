export const projectsRoutes = {
	projects: {
		route: 'projects',
		tag: 'Proyectos',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar proyecto' },
			update: { method: 'PATCH', route: '/update/:id', summary: 'Actualizar proyecto' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar proyecto' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar proyectos' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener proyecto' },
			getByFilters: { method: 'POST', route: '/get-by-filters', summary: 'Buscar proyectos' },
		},
	},
};
