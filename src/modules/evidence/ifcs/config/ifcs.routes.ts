export const ifcsRoutes = {
	ifcs: {
		route: 'ifcs',
		tag: 'IFCs',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar IFC' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar IFC' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar IFC' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar IFCs' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener el IFC completo (cabecera, resultado de logros, hallazgos, acciones)' },
			getByFilters: { method: 'POST', route: '/get-by-filters', summary: 'Buscar IFCs' },
			list: { method: 'POST', route: '/list', summary: 'Listar IFCs por nodos de organigrama' },
			submit: { method: 'POST', route: '/:id/submit', summary: 'Enviar el IFC a revisión' },
			approve: { method: 'POST', route: '/:id/approve', summary: 'Aprobar el IFC' },
			reject: { method: 'POST', route: '/:id/reject', summary: 'Rechazar el IFC con un motivo (queda en estado OBSERVED)' },
		},
	},
};
