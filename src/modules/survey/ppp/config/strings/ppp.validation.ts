export const pppValidationStrings = {
	error: {
		surveyTypeMissing: 'error.survey.ppp.surveyTypeMissing',
		surveyStatusMissing: 'error.survey.ppp.surveyStatusMissing',
		noActiveConfig: 'error.survey.ppp.noActiveConfig',
		invalidExcelFile: 'error.survey.ppp.invalidExcelFile',
		excelNoSheets: 'error.survey.ppp.excelNoSheets',
		excelEmpty: 'error.survey.ppp.excelEmpty',
		configExists: 'error.survey.ppp.configExists',
		configNotFound: 'error.survey.ppp.configNotFound',
		surveyNotFound: 'error.survey.ppp.surveyNotFound',
		invalidPracticeNumber: 'error.survey.ppp.invalidPracticeNumber',
		noScores: 'error.survey.ppp.noScores',
		invalidScore: 'error.survey.ppp.invalidScore',
		invalidRuc: 'error.survey.ppp.invalidRuc',
		uploadJobNotFound: 'error.survey.ppp.uploadJobNotFound',
		tooManyUploadJobs: 'error.survey.ppp.tooManyUploadJobs',
		uploadErrorFileNotFound: 'error.survey.ppp.uploadErrorFileNotFound',
		// Per-row bulk-upload failures. These travel to the client as keys like every
		// other error, and are rendered into words only when the backend writes the
		// annotated workbook — see `ppp-upload-messages.ts`.
		upload: {
			studentCodeRequired: 'error.survey.ppp.upload.studentCodeRequired',
			invalidPracticeNumber: 'error.survey.ppp.upload.invalidPracticeNumber',
			studentNotFound: 'error.survey.ppp.upload.studentNotFound',
			noCourseSection: 'error.survey.ppp.upload.noCourseSection',
			invalidScore: 'error.survey.ppp.upload.invalidScore',
			noScores: 'error.survey.ppp.upload.noScores',
			duplicateSurvey: 'error.survey.ppp.upload.duplicateSurvey',
			duplicateInFile: 'error.survey.ppp.upload.duplicateInFile',
			saveFailed: 'error.survey.ppp.upload.saveFailed',
		},
	},
};
