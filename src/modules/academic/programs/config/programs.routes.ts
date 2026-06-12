export const programsRoutes = {
	programs: {
		route: 'programs',
		tag: 'Carreras',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar carrera' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar carrera' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar carrera' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar carreras' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener carrera' },
			getByFilters: { method: 'POST', route: '/get-by-filters', summary: 'Buscar carreras' },
			byModality: {
				method: 'GET',
				route: '/by-modality',
				summary: 'Listar carreras de la modalidad del período académico (header)',
			},
		},
	},
};
