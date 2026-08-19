export const ifcsRoutes = {
	ifcs: {
		route: 'ifcs',
		tag: 'IFCs',
		operation: {
			create: {
				method: 'POST',
				route: '/create',
				summary: 'Crear un IFC nuevo con contenido y hallazgos en una sola transacción',
			},
			update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar IFC' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar IFC' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar IFCs' },
			getById: {
				method: 'GET',
				route: '/get-by-id/:id',
				summary: 'Obtener el IFC completo (cabecera, resultado de logros, hallazgos, acciones)',
			},
			statusHistory: {
				method: 'GET',
				route: '/:id/status-history',
				summary:
					'Obtener el historial completo de cambios de estado del IFC (solo para quienes están por encima del coordinador del curso en el organigrama, o el administrador)',
			},
			getByFilters: { method: 'POST', route: '/get-by-filters', summary: 'Buscar IFCs' },
			list: { method: 'POST', route: '/list', summary: 'Listar IFCs por nodos de organigrama' },
			schools: {
				method: 'GET',
				route: '/schools',
				summary: 'Listar las escuelas del usuario para el periodo academico (header)',
			},
			submit: { method: 'POST', route: '/:id/submit', summary: 'Enviar el IFC a revisión' },
			approve: { method: 'POST', route: '/:id/approve', summary: 'Aprobar el IFC' },
			reject: {
				method: 'POST',
				route: '/:id/reject',
				summary: 'Rechazar el IFC con un motivo (queda en estado OBSERVED)',
			},
			patch: {
				method: 'PATCH',
				route: '/:id',
				summary: 'Actualizar el IFC (información, hallazgos, acciones) y registrar un nuevo estado',
			},
			prefill: {
				method: 'GET',
				route: '/prefill',
				summary: 'Obtener cabecera + resultado de logros para el formulario en modo creación',
			},
			pdf: { method: 'GET', route: '/:id/pdf', summary: 'Generar y descargar el IFC en PDF' },
			pdfBulk: {
				method: 'POST',
				route: '/pdf/bulk',
				summary: 'Generar un ZIP con los PDFs de varios IFCs (lote)',
			},
			statusReport: {
				method: 'POST',
				route: '/status-report',
				summary: 'Generar y descargar un reporte Excel del estado de los IFCs en el alcance',
			},
			notify: {
				method: 'POST',
				route: '/notify',
				summary: 'Notificar manualmente al coordinador de un curso (envío único)',
			},
			notifyAll: {
				method: 'POST',
				route: '/notify-all',
				summary: 'Notificar manualmente al lote de cursos en el alcance',
			},
		},
	},
};
