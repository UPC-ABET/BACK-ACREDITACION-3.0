export const graRoutes = {
	root: 'gra',
	tag: 'GRA - Encuestas de Graduandos',
	config: {
		create: {
			method: 'POST',
			route: 'config/create',
			summary: 'Crear configuración de competencia GRA',
		},
		getAll: {
			method: 'GET',
			route: 'config/get-all',
			summary: 'Listar todas las configuraciones GRA',
		},
		getByFilters: {
			method: 'POST',
			route: 'config/get-by-filters',
			summary: 'Filtrar configuraciones GRA',
		},
		getById: {
			method: 'GET',
			route: 'config/get-by-id/:id',
			summary: 'Obtener configuración GRA por ID',
		},
		update: { method: 'PUT', route: 'config/update/:id', summary: 'Actualizar configuración GRA' },
		delete: { method: 'DELETE', route: 'config/delete/:id', summary: 'Eliminar configuración GRA' },
		replicate: {
			method: 'POST',
			route: 'config/replicate',
			summary: 'Replicar configuraciones GRA del período anterior (incluye niveles de aceptación)',
		},
	},
	notification: {
		save: {
			method: 'POST',
			route: 'notification/save',
			summary: 'Agregar estudiante a lista de encuesta GRA',
		},
		listStudents: {
			method: 'POST',
			route: 'notification/list-students',
			summary: 'Listar estudiantes con estado de notificación GRA',
		},
		delete: {
			method: 'DELETE',
			route: 'notification/delete/:id',
			summary: 'Eliminar estudiante de la lista GRA',
		},
	},
	email: {
		send: {
			method: 'POST',
			route: 'email/send',
			summary: 'Enviar encuestas GRA por correo a estudiantes pendientes',
		},
	},
	token: {
		validate: {
			method: 'GET',
			route: 'token/validate/:token',
			summary: 'Validar token de encuesta GRA (sin autenticación)',
		},
	},
	survey: {
		getByToken: {
			method: 'POST',
			route: 'survey/get-by-token',
			summary: 'Obtener formulario de encuesta GRA por token',
		},
		complete: {
			method: 'POST',
			route: 'survey/complete',
			summary: 'Completar y enviar encuesta GRA',
		},
	},
	outcomes: {
		list: {
			method: 'POST',
			route: 'outcomes/list',
			summary:
				'Listar outcomes disponibles agrupados por comisión (para selector de competencias GRA)',
		},
	},
	dashboard: {
		get: { method: 'POST', route: 'dashboard', summary: 'Dashboard de progreso de encuestas GRA' },
	},
};
