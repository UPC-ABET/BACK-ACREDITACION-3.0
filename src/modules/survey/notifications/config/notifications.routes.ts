export const notificationsRoutes = {
	notifications: {
		route: 'notifications',
		tag: 'Notificaciones',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar notificación' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar notificación' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar notificación' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar notificaciones' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener notificación' },
			getByFilters: { method: 'POST', route: '/get-by-filters', summary: 'Buscar notificaciones' },
		},
	},
};
