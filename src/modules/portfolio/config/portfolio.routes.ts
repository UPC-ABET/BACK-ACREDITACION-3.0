export const portfolioRoutes = {
	portfolio: {
		route: 'portfolio',
		tag: 'Portfolio',
		operation: {
			// ── CRUD ─────────────────────────────────────────────────────────────
			create: { method: 'POST', route: '/create', summary: 'Create portfolio project' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Update portfolio project' },
			updateManager: {
				method: 'PUT',
				route: '/update-manager/:id',
				summary: 'Update project (manager view)',
			},
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Delete portfolio project' },
			getAll: {
				method: 'POST',
				route: '/get-all',
				summary: 'List portfolio projects (paginated + filters)',
			},
			getById: {
				method: 'GET',
				route: '/get-by-id/:id',
				summary: 'Get portfolio project by ID with all relations',
			},
			// ── Students ──────────────────────────────────────────────────────────
			unassignStudent: {
				method: 'DELETE',
				route: '/unassign-student/:projectId/:studentId',
				summary: 'Unassign student from project',
			},
			autoAssignPartner: {
				method: 'POST',
				route: '/auto-assign-partner',
				summary: 'Auto-assign partner student in same section',
			},
			managementAssign: {
				method: 'POST',
				route: '/management-assign',
				summary: 'Manually assign student(s) to project',
			},
			// ── Migration ─────────────────────────────────────────────────────────
			migrate: {
				method: 'PUT',
				route: '/migrate',
				summary: 'Migrate projects to a new academic period and section',
			},
			// ── Teachers ──────────────────────────────────────────────────────────
			getTeachersByModality: {
				method: 'GET',
				route: '/get-teachers-by-modality/:modalityTypeId',
				summary: 'Get teachers with projects by modality',
			},
			getTeacherTotalProjects: {
				method: 'GET',
				route: '/get-teacher-total-projects/:professorId',
				summary: 'Get total projects of a professor (co-author and consultant)',
			},
			// ── Companies ─────────────────────────────────────────────────────────
			getCompanies: {
				method: 'GET',
				route: '/get-companies',
				summary: 'Get companies by academic period and modality',
			},
			createCompany: { method: 'POST', route: '/create-company', summary: 'Create a company' },
			// ── Research lines ────────────────────────────────────────────────────
			getResearchLines: {
				method: 'GET',
				route: '/get-research-lines',
				summary: 'Get research lines (optional filter by program and modality)',
			},
			createResearchLine: {
				method: 'POST',
				route: '/create-research-line',
				summary: 'Create a research line',
			},
			// ── Applications ──────────────────────────────────────────────────────
			getApplicationsByProject: {
				method: 'GET',
				route: '/get-applications/:projectId',
				summary: 'Get all applications for a project',
			},
			createApplication: {
				method: 'POST',
				route: '/create-application/:projectId/:studentId',
				summary: 'Apply a student to a project',
			},
			deleteApplication: {
				method: 'DELETE',
				route: '/delete-application/:applicationId',
				summary: 'Delete a project application',
			},
			// ── Bulk upload ───────────────────────────────────────────────────────
			getBulkUploadTemplate: {
				method: 'POST',
				route: '/bulk-upload/template',
				summary: 'Get basic bulk upload template (Base64 JSON)',
			},
			downloadBulkUploadTemplate: {
				method: 'GET',
				route: '/bulk-upload/template-file',
				summary: 'Download basic bulk upload Excel template',
			},
			downloadBulkUploadFilledTemplate: {
				method: 'GET',
				route: '/bulk-upload/filled-template-file',
				summary: 'Download filled bulk upload Excel template',
			},
			bulkUpload: {
				method: 'POST',
				route: '/bulk-upload/:academicPeriodId/:modalityTypeId',
				summary: 'Basic bulk upload of portfolio projects from Excel',
			},
			bulkUploadFilled: {
				method: 'POST',
				route: '/bulk-upload/filled/:academicPeriodId/:modalityTypeId/:courseSectionId',
				summary: 'Filled bulk upload (with students, title, research line) from Excel',
			},
			// ── Export ────────────────────────────────────────────────────────────
			export: {
				method: 'POST',
				route: '/export',
				summary: 'Export filtered portfolio projects to Excel',
			},
		},
	},
};
