export const usersRoutes = {
	route: 'users',
	tag: 'Usuarios',
	operation: {
		create: { method: 'POST', route: '/create', summary: 'Crear usuario' },
		update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar usuario' },
		delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar usuario' },
		getAll: { method: 'GET', route: '/get-all', summary: 'Listar usuarios' },
		getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener usuario' },
		getByFilters: { method: 'POST', route: '/get-by-filters', summary: 'Buscar usuarios' },
		loginByCredentials: {
			method: 'POST',
			route: '/login-by-credentials',
			summary: 'Login de usuario por credenciales',
		},
		requestPasswordReset: {
			method: 'POST',
			route: '/request-password-reset',
			summary: 'Request password reset email',
		},
		resetPassword: {
			method: 'POST',
			route: '/reset-password',
			summary: 'Reset user password',
		},
		me: { method: 'GET', route: '/me', summary: 'Get current user profile' },
		logout: { method: 'POST', route: '/logout', summary: 'Cerrar Sesión Usuario' },
	},
};
