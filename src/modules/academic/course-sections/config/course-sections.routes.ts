export const courseSectionsRoutes = {
	course_sections: {
		route: 'course-sections',
		tag: 'Secciones de curso',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar sección de curso' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar sección de curso' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar sección de curso' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar secciones de curso' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener sección de curso' },
			getByFilters: { method: 'POST', route: '/get-by-filters', summary: 'Buscar secciones de curso' },
		},
	},
};
