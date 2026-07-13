export const outcomeConversionsRoutes = {
	outcomeConversions: {
		route: 'accreditation/outcome-conversions',
		tag: 'Outcome Conversions',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar conversion de outcome' },
			update: {
				method: 'PUT',
				route: '/update/:id',
				summary: 'Actualizar conversion de outcome',
				params: [{ name: 'id', description: 'ID de la conversion', type: Number }],
			},
			delete: {
				method: 'DELETE',
				route: '/delete/:id',
				summary: 'Eliminar conversion de outcome',
				params: [{ name: 'id', description: 'ID de la conversion', type: Number }],
			},
			getById: {
				method: 'GET',
				route: '/get-by-id/:id',
				summary: 'Obtener conversion de outcome',
				params: [{ name: 'id', description: 'ID de la conversion', type: Number }],
			},
			getByFilters: {
				method: 'POST',
				route: '/get-by-filters',
				summary: 'Listar conversiones de outcome con codigos resueltos',
			},
			coverage: {
				method: 'GET',
				route: '/coverage',
				summary: 'Cobertura de conversion por comision destino (outcomes sin formula)',
			},
		},
	},
};
