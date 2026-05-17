export const lcfcRoutes = {
	root: 'lcfc',
	tag: 'LCFC - Logro de Fin de Ciclo',
	config: {
		generate: { method: 'POST', route: 'config/generate', summary: 'Generar configuraciones de cursos LCFC para un período y programa' },
		getAll: { method: 'GET', route: 'config/get-all', summary: 'Listar todas las configuraciones de cursos LCFC' },
		getByFilters: { method: 'POST', route: 'config/get-by-filters', summary: 'Filtrar configuraciones de cursos LCFC' },
		updateStatus: { method: 'POST', route: 'config/update-status', summary: 'Actualizar estado activo/inactivo de cursos LCFC (bulk)' },
	},
	notification: {
		send: { method: 'POST', route: 'notification/send', summary: 'Enviar encuestas LCFC por correo a estudiantes matriculados en cursos activos' },
	},
	token: {
		validate: { method: 'GET', route: 'token/validate/:token', summary: 'Validar token de encuesta LCFC (sin autenticación JWT)' },
	},
	survey: {
		getByToken: { method: 'POST', route: 'survey/get-by-token', summary: 'Obtener formulario de encuesta LCFC con outcomes del curso' },
		complete: { method: 'POST', route: 'survey/complete', summary: 'Completar y guardar encuesta LCFC con puntajes por outcome' },
	},
	dashboard: {
		get: { method: 'POST', route: 'dashboard', summary: 'Dashboard LCFC: progreso de encuestas completadas vs pendientes' },
	},
};
