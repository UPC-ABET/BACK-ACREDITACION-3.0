export const ardsRoutes = {
	ards: {
		route: 'ards',
		tag: 'ARD',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Create ARD' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Update ARD' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Delete ARD' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Get ARD detail' },
			maintenance: { method: 'GET', route: '/maintenance', summary: 'List ARDs' },
			classRepresentatives: {
				method: 'GET',
				route: '/class-representatives',
				summary: 'List class representative students by program and campus',
			},
			programCourses: {
				method: 'GET',
				route: '/program-courses',
				summary: 'List program courses from the organization chart',
			},
			courseProfessors: {
				method: 'GET',
				route: '/course-professors',
				summary: 'List distinct professors of a course by campus',
			},
			export: {
				method: 'POST',
				route: '/export',
				summary: 'Export ARDs to Excel filtered by program, areas and subareas',
			},
			attendanceExport: {
				method: 'POST',
				route: '/attendance-export',
				summary: 'Export the attendance (delegate students) of a single ARD to Excel',
			},
			detailsBulk: {
				method: 'POST',
				route: '/details/bulk',
				summary: 'Bulk create ARD details',
			},
		},
	},
};
