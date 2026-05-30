export const notificationMessagesRoutes = {
	notificationMessages: {
		route: 'notification-messages',
		tag: 'Mensajes de notificación',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar mensaje de notificación' },
			update: {
				method: 'PUT',
				route: '/update/:id',
				summary: 'Actualizar mensaje de notificación',
			},
			delete: {
				method: 'DELETE',
				route: '/delete/:id',
				summary: 'Eliminar mensaje de notificación',
			},
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar mensajes de notificación' },
			getById: {
				method: 'GET',
				route: '/get-by-id/:id',
				summary: 'Obtener mensaje de notificación',
			},
			getByFilters: {
				method: 'POST',
				route: '/get-by-filters',
				summary: 'Buscar mensajes de notificación',
			},
		},
	},
};
