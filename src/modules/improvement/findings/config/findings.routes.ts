export const findingsRoutes = {
	findings: {
		route: 'findings',
		tag: 'Hallazgos',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar hallazgo' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar hallazgo' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar hallazgo' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar hallazgos' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener hallazgo' },
			getByFilters: { method: 'POST', route: '/get-by-filters', summary: 'Buscar hallazgos' },
		},
	},
};
