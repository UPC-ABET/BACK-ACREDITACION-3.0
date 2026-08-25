export const chartsRoutes = {
	charts: {
		route: 'charts',
		tag: 'Organigramas',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar organigrama' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar organigrama' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar organigrama' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar organigramas' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener organigrama' },
			getByFilters: { method: 'POST', route: '/get-by-filters', summary: 'Buscar organigramas' },
			maintenanceTree: {
				method: 'GET',
				route: '/maintenance/tree',
				summary: 'Obtener el organigrama del periodo academico y escuela (headers)',
			},
			maintenanceCreate: {
				method: 'POST',
				route: '/maintenance/create',
				summary: 'Crear un nodo hijo en el organigrama',
			},
			maintenanceUpdate: {
				method: 'PUT',
				route: '/maintenance/update/:id',
				summary: 'Actualizar un nodo del organigrama',
				params: [{ name: 'id', description: 'ID del nodo del organigrama', type: Number }],
			},
			maintenanceDelete: {
				method: 'DELETE',
				route: '/maintenance/:id',
				summary: 'Eliminar un nodo y sus descendientes del organigrama',
				params: [{ name: 'id', description: 'ID del nodo del organigrama', type: Number }],
			},
			maintenanceResetPasswords: {
				method: 'POST',
				route: '/maintenance/reset-password',
				summary: 'Restablecer la contrasena por defecto de los usuarios de los tipos seleccionados',
			},
		},
	},
};
