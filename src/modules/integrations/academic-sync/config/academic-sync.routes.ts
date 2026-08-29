export const academicSyncRoutes = {
	route: 'integrations/academic-sync',
	tag: 'Integrations - Academic Sync',
	operation: {
		getPeriods: {
			method: 'GET',
			route: '/periods',
			summary: 'List academic periods for external mirroring',
		},
		getCampuses: {
			method: 'GET',
			route: '/campuses',
			summary: 'List campuses for external mirroring',
		},
		getCourses: {
			method: 'GET',
			route: '/courses',
			summary: 'List study plan courses, with sections and commission, for an academic period',
		},
		getOrgChart: {
			method: 'GET',
			route: '/org-chart',
			summary: 'List org chart nodes with assigned staff for an academic period',
		},
		getUsers: {
			method: 'GET',
			route: '/users',
			summary: 'List the organization-wide user directory',
		},
	},
};
