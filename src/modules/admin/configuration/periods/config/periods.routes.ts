export const periodsRoutes = {
	periods: {
		route: 'configuration/periods',
		tag: 'Configuración — Períodos Académicos',
		operation: {
			create: { method: 'POST', route: '', summary: 'Abrir período académico (Fase 0, no activo)' },
			activate: {
				method: 'PATCH',
				route: ':id/activate',
				summary: 'Activar período (desactiva el activo previo de la misma modalidad)',
			},
			list: {
				method: 'GET',
				route: '',
				summary: 'Listar períodos académicos (activos e inactivos)',
			},
			find: { method: 'GET', route: ':id', summary: 'Obtener período académico por id' },
		},
	},
};
