export const portfolioAccessRoutes = {
	access: {
		route: 'portfolio',
		tag: 'Portfolio',
		operation: {
			getMyAccess: {
				method: 'GET',
				route: '/access/me',
				summary: 'Get my portfolio folder access config',
			},
			getUsers: {
				method: 'GET',
				route: '/access/users',
				summary: 'List users with their portfolio access config (admin only)',
			},
			getUserAccess: {
				method: 'GET',
				route: '/access/user/:userId',
				summary: 'Get portfolio access config for a specific user (admin only)',
			},
			updateUserAccess: {
				method: 'PUT',
				route: '/access/user/:userId',
				summary: 'Update portfolio access config for a specific user (admin only)',
			},
		},
	},
};
