export const acceptanceLevelsRoutes = {
	root: 'acceptance-levels',
	tag: 'Acceptance Levels - Niveles de Aceptación de Encuestas',
	list: {
		method: 'POST',
		route: 'list',
		summary:
			'Listar niveles de aceptación por tipo de encuesta y período (genera defaults si no existen)',
	},
	bulkUpdate: {
		method: 'PUT',
		route: 'bulk-update',
		summary: 'Actualizar rangos y nombres de niveles de aceptación',
	},
	generateDefaults: {
		method: 'POST',
		route: 'generate-defaults',
		summary:
			'Generar niveles de aceptación predeterminados (1-5) para un tipo de encuesta y período',
	},
};
