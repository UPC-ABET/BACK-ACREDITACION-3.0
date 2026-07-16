export const lcfcRoutes = {
	root: 'lcfc',
	tag: 'LCFC - End-of-Cycle Achievement Survey',
	config: {
		generate: {
			method: 'POST',
			route: 'config/generate',
			summary: 'Generate LCFC course configurations for a period and program',
		},
		getAll: {
			method: 'GET',
			route: 'config/get-all',
			summary: 'List all LCFC course configurations',
		},
		getByFilters: {
			method: 'POST',
			route: 'config/get-by-filters',
			summary: 'Filter LCFC course configurations',
		},
		listSections: {
			method: 'POST',
			route: 'config/list-sections',
			summary:
				'Lightweight list of LCFC course sections (id, course, section, status) — avoids transferring full config rows',
		},
		getById: {
			method: 'GET',
			route: 'config/get-by-id/:id',
			summary: 'Get an LCFC course configuration by ID',
		},
		update: {
			method: 'PUT',
			route: 'config/update/:id',
			summary: 'Update an LCFC course configuration',
		},
		updateStatus: {
			method: 'POST',
			route: 'config/update-status',
			summary: 'Bulk update active/inactive status of LCFC courses',
		},
		clone: {
			method: 'POST',
			route: 'config/clone',
			summary:
				'Clone LCFC configuration: generate target period and copy course status from source',
		},
		delete: {
			method: 'DELETE',
			route: 'config/delete/:id',
			summary: 'Delete an LCFC course configuration',
		},
		availableSections: {
			method: 'GET',
			route: 'config/available-sections',
			summary:
				'List course sections available for config generation (courses, including electives, whose outcomes in the period are exclusively Control-type)',
		},
		sectionOutcomes: {
			method: 'GET',
			route: 'config/section-outcomes',
			summary: "List a course section's outcomes for the given program (for config editing)",
		},
		sectionCommissions: {
			method: 'GET',
			route: 'config/section-commissions',
			summary:
				"List a course section's commissions (for config editing — select commission instead of outcome)",
		},
		setDeadline: {
			method: 'POST',
			route: 'config/set-deadline',
			summary:
				'Set the survey deadline for a program/period: stored on the config and applied to existing notifications (no resend)',
		},
	},
	notification: {
		summary: {
			method: 'POST',
			route: 'notification/summary',
			summary:
				'Preview how many careers and students would be notified by a send (or resend, ' +
				'when the "reenviar a quienes ya recibieron" flag is set)',
		},
		send: {
			method: 'POST',
			route: 'notification/send',
			summary: 'Send LCFC surveys by email to students enrolled in active courses',
		},
		status: {
			method: 'GET',
			route: 'notification/status/:jobId',
			summary: 'Get LCFC notification send job progress',
		},
	},
	token: {
		validate: {
			method: 'GET',
			route: 'token/validate/:token',
			summary: 'Validate LCFC survey token (no JWT authentication)',
		},
	},
	survey: {
		listByToken: {
			method: 'GET',
			route: 'survey/list-by-token/:token',
			summary: "List all of the student's LCFC surveys (from any of their tokens)",
		},
		getByToken: {
			method: 'POST',
			route: 'survey/get-by-token',
			summary: 'Get LCFC survey form with course outcomes',
		},
		complete: {
			method: 'POST',
			route: 'survey/complete',
			summary: 'Submit completed LCFC survey with outcome scores',
		},
	},
	dashboard: {
		get: {
			method: 'POST',
			route: 'dashboard',
			summary: 'LCFC dashboard: completed vs pending survey progress',
		},
		export: {
			method: 'GET',
			route: 'export',
			summary: 'Download completed LCFC surveys with scores as an Excel file',
		},
		reportPdf: {
			method: 'GET',
			route: 'report-pdf',
			summary: 'Download the LCFC results report (completion by program/course) as a PDF',
		},
		reportPerception: {
			method: 'POST',
			route: 'report/perception',
			summary:
				'Generate the LCFC perception-by-outcome PDF report (all sedes + one per sede). ' +
				'With no program/commission/campus filter, returns a per-program completion overview PDF instead',
		},
	},
};
