import { HttpStatus } from '@nestjs/common';
import { uploadLogsValidationStrings } from '../config/strings/upload-logs.validation';

const E = uploadLogsValidationStrings.error;

export const ROLLBACK_RAISE_MAP: Record<string, { key: string; status: HttpStatus }> = {
	uploadLogNotFound: { key: E.uploadLogNotFound, status: HttpStatus.NOT_FOUND },
	rollbackBlockedSections: { key: E.rollbackBlockedSections, status: HttpStatus.CONFLICT },
	rollbackBlockedOutcomes: { key: E.rollbackBlockedOutcomes, status: HttpStatus.CONFLICT },
	rollbackBlockedOutcomeRefs: { key: E.rollbackBlockedOutcomeRefs, status: HttpStatus.CONFLICT },
	rollbackBlockedSectionRefs: { key: E.rollbackBlockedSectionRefs, status: HttpStatus.CONFLICT },
	rollbackBlockedEnrollmentRefs: {
		key: E.rollbackBlockedEnrollmentRefs,
		status: HttpStatus.CONFLICT,
	},
	rollbackBlockedSectionEnrollmentRefs: {
		key: E.rollbackBlockedSectionEnrollmentRefs,
		status: HttpStatus.CONFLICT,
	},
	rollbackBlockedProfessors: { key: E.rollbackBlockedProfessors, status: HttpStatus.CONFLICT },
	rollbackBlockedStaff: { key: E.rollbackBlockedStaff, status: HttpStatus.CONFLICT },
	rollbackBlockedNewerUpload: { key: E.rollbackBlockedNewerUpload, status: HttpStatus.CONFLICT },
};
