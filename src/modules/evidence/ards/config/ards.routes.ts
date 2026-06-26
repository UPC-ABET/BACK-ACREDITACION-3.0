export const ardsRoutes = {
	ards: {
		route: 'ards',
		tag: 'ARD',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Create ARD meeting' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Update ARD meeting' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Delete ARD meeting' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Get ARD meeting detail' },
			attendees: {
				method: 'GET',
				route: '/attendees',
				summary: 'List ARD delegates and guest students',
			},
			programCourses: {
				method: 'GET',
				route: '/program-courses',
				summary: 'List program courses with sections and professors',
			},
			maintenance: { method: 'GET', route: '/maintenance', summary: 'List ARD meetings' },
		},
	},
};
