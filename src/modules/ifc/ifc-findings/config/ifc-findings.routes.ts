export const ifcFindingsRoutes = {
	ifc_findings: {
		route: 'ifc-findings',
		tag: 'Hallazgos de IFC',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar relación IFC-hallazgo' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar relación IFC-hallazgo' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar relación IFC-hallazgo' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar relaciones IFC-hallazgo' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener relación IFC-hallazgo' },
			getByFilters: { method: 'POST', route: '/get-by-filters', summary: 'Buscar relaciones IFC-hallazgo' },
		},
	},
};
