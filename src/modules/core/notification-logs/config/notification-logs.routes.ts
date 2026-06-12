export const notificationLogsRoutes = {
	notificationLogs: {
		route: 'notification-logs',
		tag: 'Bitacora de notificaciones',
		operation: {
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar bitacora de notificaciones' },
			getById: {
				method: 'GET',
				route: '/get-by-id/:id',
				summary: 'Obtener registro de bitacora',
			},
			getByFilters: {
				method: 'POST',
				route: '/get-by-filters',
				summary: 'Buscar registros de bitacora',
			},
		},
	},
};
