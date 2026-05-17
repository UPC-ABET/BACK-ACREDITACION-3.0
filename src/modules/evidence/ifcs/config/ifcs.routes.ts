export const ifcsRoutes = {
	ifcs: {
		route: 'ifcs',
		tag: 'IFCs',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar IFC' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar IFC' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar IFC' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar IFCs' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener IFC' },
			getByFilters: { method: 'POST', route: '/get-by-filters', summary: 'Buscar IFCs' },
			list: { method: 'POST', route: '/list', summary: 'Listar IFCs por nodos de organigrama' },
		},
	},
};
