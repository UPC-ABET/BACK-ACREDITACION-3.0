export const programCommissionsRoutes = {
	programCommissions: {
		route: 'configuration/program-commissions',
		tag: 'Configuración — Asociación Carrera × Comisión',
		operation: {
			associate: {
				method: 'POST',
				route: '',
				summary: 'Asociar carrera a una comisión acreditadora dentro de un período (Fase 0)',
			},
			unassociate: {
				method: 'DELETE',
				route: ':id',
				summary: 'Desasociar carrera-comisión (bloqueado si ya existen outcomes)',
			},
			list: {
				method: 'GET',
				route: '',
				summary: 'Listar asociaciones carrera-comisión de un período',
			},
		},
	},
};
