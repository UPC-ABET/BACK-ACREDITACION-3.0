export const periodsRoutes = {
	periods: {
		route: 'configuration/periods',
		tag: 'Configuración — Períodos Académicos',
		operation: {
			create: { method: 'POST', route: '', summary: 'Abrir período académico (Fase 0)' },
			list: { method: 'GET', route: '', summary: 'Listar períodos académicos activos' },
			find: { method: 'GET', route: ':periodId', summary: 'Obtener período académico por id' },
			close: {
				method: 'DELETE',
				route: ':periodId',
				summary: 'Cerrar período académico (soft-close: status=INA + is_active=false)',
			},
		},
	},
};
