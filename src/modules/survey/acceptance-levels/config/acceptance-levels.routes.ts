export const acceptanceLevelsRoutes = {
	root: 'acceptance-levels',
	tag: 'Performance Levels - Survey Performance Levels',
	list: {
		method: 'POST',
		route: 'list',
		summary: 'List performance levels by survey type and period (generates defaults if none exist)',
	},
	bulkUpdate: {
		method: 'PUT',
		route: 'bulk-update',
		summary: 'Bulk update performance level ranges and names',
	},
	generateDefaults: {
		method: 'POST',
		route: 'generate-defaults',
		summary: 'Generate default performance levels (1–5) for a survey type and period',
	},
};
