export const roleModulePermissionsRoutes = {
	route: 'admin-role-module-permissions',
	tag: 'IAM - Permisos por Rol y Modulo',
	operation: {
		create: {
			method: 'POST',
			route: '/create',
			summary: 'Asignar modulo y permiso a un rol',
		},
		update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar asignacion' },
		delete: { method: 'DELETE', route: '/delete/:id', summary: 'Quitar permiso del rol' },
		getAll: { method: 'GET', route: '/get-all', summary: 'Listar asignaciones' },
		getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener asignacion' },
		getByFilters: {
			method: 'POST',
			route: '/get-by-filters',
			summary: 'Buscar asignaciones (por roleId / moduleTypeId / permissionTypeId)',
		},
	},
};
