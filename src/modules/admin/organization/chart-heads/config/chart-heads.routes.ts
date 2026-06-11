export const chartHeadsRoutes = {
	chartHeads: {
		route: 'admin-chart-heads',
		tag: 'Configuracion de Cabezas del Organigrama',
		operation: {
			configure: {
				method: 'POST',
				route: '/configure',
				summary: 'Configurar el Decano y los Directores de Escuela de un periodo',
			},
			getByPeriod: {
				method: 'GET',
				route: '/:academicPeriodId',
				summary: 'Obtener el Decano y los Directores de Escuela configurados para un periodo',
			},
		},
	},
};
