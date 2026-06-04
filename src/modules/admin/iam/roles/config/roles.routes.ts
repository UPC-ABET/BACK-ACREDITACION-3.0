export const rolesRoutes = {
	route: 'admin-roles',
	tag: 'IAM - Roles',
	operation: {
		create: { method: 'POST', route: '/create', summary: 'Crear rol' },
		update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar rol' },
		delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar rol' },
		getAll: { method: 'GET', route: '/get-all', summary: 'Listar roles' },
		getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener rol' },
		getByFilters: { method: 'POST', route: '/get-by-filters', summary: 'Buscar roles' },
	},
};
