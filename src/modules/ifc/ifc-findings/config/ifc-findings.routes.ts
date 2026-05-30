export const ifcFindingsRoutes = {
	ifcFindings: {
		route: 'ifc-findings',
		tag: 'Hallazgos de IFC',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar relación IFC-hallazgo' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar relación IFC-hallazgo' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar relación IFC-hallazgo' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar relaciones IFC-hallazgo' },
			getById: {
				method: 'GET',
				route: '/get-by-id/:id',
				summary: 'Obtener un hallazgo con sus acciones de mejora asociadas',
			},
			getByFilters: {
				method: 'POST',
				route: '/get-by-filters',
				summary: 'Buscar relaciones IFC-hallazgo',
			},
			list: {
				method: 'POST',
				route: '/list',
				summary: 'Listar hallazgos asociados a IFCs por nodos del organigrama y período',
			},
			deleteCascade: {
				method: 'DELETE',
				route: '/:id',
				summary: 'Eliminar un hallazgo y sus acciones / mapeos / junctions en una sola transacción',
			},
			patch: { method: 'PATCH', route: '/:id', summary: 'Actualizar la descripción del hallazgo' },
		},
	},
};
