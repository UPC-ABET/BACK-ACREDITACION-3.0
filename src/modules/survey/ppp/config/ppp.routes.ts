export const pppRoutes = {
	root: 'ppp',
	tag: 'PPP - Encuestas de Prácticas Pre-Profesionales',
	config: {
		create: { method: 'POST', route: 'config/create', summary: 'Crear configuración de competencia PPP' },
		getAll: { method: 'GET', route: 'config/get-all', summary: 'Listar todas las configuraciones PPP' },
		getByFilters: { method: 'POST', route: 'config/get-by-filters', summary: 'Filtrar configuraciones PPP' },
		getById: { method: 'GET', route: 'config/get-by-id/:id', summary: 'Obtener configuración PPP por ID' },
		update: { method: 'PUT', route: 'config/update/:id', summary: 'Actualizar configuración PPP' },
		delete: { method: 'DELETE', route: 'config/delete/:id', summary: 'Eliminar configuración PPP' },
		replicate: { method: 'POST', route: 'config/replicate', summary: 'Replicar configuraciones PPP del período anterior' },
	},
	survey: {
		create: { method: 'POST', route: 'survey/create', summary: 'Registrar encuesta PPP individual' },
		getAll: { method: 'GET', route: 'survey/get-all', summary: 'Listar encuestas PPP' },
		getByFilters: { method: 'POST', route: 'survey/get-by-filters', summary: 'Filtrar encuestas PPP' },
		getById: { method: 'GET', route: 'survey/get-by-id/:id', summary: 'Obtener encuesta PPP por ID' },
		uploadExcel: { method: 'POST', route: 'survey/upload-excel', summary: 'Carga masiva de datos PPP desde Excel base64' },
		dashboard: { method: 'POST', route: 'survey/dashboard', summary: 'Dashboard de resultados y puntajes PPP' },
		generateFindings: { method: 'POST', route: 'survey/generate-findings', summary: 'Análisis automático de hallazgos PPP (ROJO/AMARILLO/VERDE)' },
	},
};
