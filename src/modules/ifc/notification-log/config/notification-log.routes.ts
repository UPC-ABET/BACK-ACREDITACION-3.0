export const notificationLogRoutes = {
	notification_log: {
		route: 'ifc-notification-log',
		tag: 'Log de Notificaciones IFC',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar entrada de log de notificacion IFC' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar entrada de log de notificacion IFC' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar entrada de log de notificacion IFC' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar log de notificaciones IFC' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener entrada de log de notificacion IFC' },
			getByFilters: { method: 'POST', route: '/get-by-filters', summary: 'Buscar entradas de log de notificacion IFC' },
		},
	},
};
