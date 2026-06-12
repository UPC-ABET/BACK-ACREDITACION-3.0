export const emailTemplatesRoutes = {
	emailTemplates: {
		route: 'email-templates',
		tag: 'Plantillas de correo',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar plantilla de correo' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar plantilla de correo' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar plantilla de correo' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar plantillas de correo' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener plantilla de correo' },
			getByFilters: {
				method: 'POST',
				route: '/get-by-filters',
				summary: 'Buscar plantillas de correo (filtrar por categoria para los tabs)',
			},
			getByCode: {
				method: 'GET',
				route: '/get-by-code/:code',
				summary: 'Obtener plantilla de correo por codigo',
			},
		},
	},
};
