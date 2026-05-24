export const notificationConfigsRoutes = {
	notification_configs: {
		route: 'ifc-notification-configs',
		tag: 'Configuracion de Notificaciones IFC',
		operation: {
			create: {
				method: 'POST',
				route: '/create',
				summary: 'Registrar configuracion de notificacion IFC',
			},
			update: {
				method: 'PUT',
				route: '/update/:id',
				summary: 'Actualizar configuracion de notificacion IFC',
			},
			delete: {
				method: 'DELETE',
				route: '/delete/:id',
				summary: 'Eliminar configuracion de notificacion IFC',
			},
			getAll: {
				method: 'GET',
				route: '/get-all',
				summary: 'Listar configuraciones de notificacion IFC',
			},
			getById: {
				method: 'GET',
				route: '/get-by-id/:id',
				summary: 'Obtener configuracion de notificacion IFC',
			},
			getByFilters: {
				method: 'POST',
				route: '/get-by-filters',
				summary: 'Buscar configuraciones de notificacion IFC',
			},
			byPeriod: {
				method: 'GET',
				route: '/by-period',
				summary: 'Listar configuraciones de notificación de la escuela del usuario para un período',
			},
			upsert: {
				method: 'POST',
				route: '/upsert',
				summary: 'Crear o actualizar (por UNIQUE) una configuración de notificación',
			},
			softDelete: {
				method: 'DELETE',
				route: '/:id',
				summary: 'Marcar una configuración como inactiva (is_active=false)',
			},
		},
	},
};
