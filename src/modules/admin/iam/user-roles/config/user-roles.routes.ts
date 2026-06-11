export const userRolesRoutes = {
	route: 'admin-user-roles',
	tag: 'IAM - Asignacion de Roles a Usuarios',
	operation: {
		create: { method: 'POST', route: '/create', summary: 'Asignar rol a usuario' },
		update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar asignacion de rol' },
		delete: { method: 'DELETE', route: '/delete/:id', summary: 'Quitar rol de usuario' },
		getAll: { method: 'GET', route: '/get-all', summary: 'Listar asignaciones de roles' },
		getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener asignacion de rol' },
		getByFilters: {
			method: 'POST',
			route: '/get-by-filters',
			summary: 'Buscar asignaciones de roles (por userId / roleId)',
		},
	},
};
