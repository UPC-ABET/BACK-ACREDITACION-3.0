export const portfolioValidationStrings = {
	error: {
		companyRequired:
			'Company identifier is required: provide either companyId or companyCode.',
		projectNotFound: 'Portfolio project not found.',
		studentOneNotFound: 'Student 1 not found.',
		studentTwoNotFound: 'Student 2 not found.',
		coauthorNotFound: 'Co-author professor not found.',
		consultantNotFound: 'Consultant professor not found.',
		hasApplications:
			'Project cannot be deleted because it has active student applications.',
		studentNotAssigned: 'The student is not assigned to this project.',
		applicationExists: 'The student already has an application for this project.',
		periodNotFound: 'Academic period not found.',
		noPeriodForModality: 'No active period found for the specified modality.',
		companyNotFoundByCode: 'Company not found for the provided code, academic period and modality.',
		companyNotFoundById: 'Company not found.',
		programNotFound: 'Program not found.',
	},
	result: {
		createFailed: 'Failed to create portfolio project.',
		updateFailed: 'Failed to update portfolio project.',
		deleteFailed: 'Failed to delete portfolio project.',
		projectAutoDeleted:
			'Project was automatically deleted after all students were unassigned.',
	},
};
