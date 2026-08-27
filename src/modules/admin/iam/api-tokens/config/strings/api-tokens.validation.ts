export const apiTokensValidationStrings = {
	error: {
		notFound: 'error.apiToken.notFound',
		alreadyRevoked: 'error.apiToken.alreadyRevoked',
		emptyScopes: 'error.apiToken.emptyScopes',
		unknownModuleOrAction: 'error.apiToken.unknownModuleOrAction',
		// Shared by "unknown keyId" and "wrong secret" so the two rejections stay
		// indistinguishable to the caller (AC-5).
		invalidApiKey: 'error.apiToken.invalidApiKey',
		unauthorizedRoute: 'error.apiToken.unauthorizedRoute',
		insufficientScope: 'error.apiToken.insufficientScope',
	},
	result: {
		createFailed: 'error.apiToken.createFailed',
		updateFailed: 'error.apiToken.updateFailed',
		deleteFailed: 'error.apiToken.deleteFailed',
	},
};
