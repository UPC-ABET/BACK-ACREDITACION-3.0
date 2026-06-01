import { HttpStatus } from '@nestjs/common';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import { uploadLogsValidationStrings } from '../config/strings/upload-logs.validation';

const E = uploadLogsValidationStrings.error;

// Short codes RAISEd by the PG rollback functions → the frontend i18n key + HTTP status the backend
// surfaces. (Mirrors the per-row pattern: the DB emits a short code, the backend maps it for the client.)
export const ROLLBACK_RAISE_MAP: Record<string, { key: string; status: HttpStatus }> = {
	uploadLogNotFound: { key: E.uploadLogNotFound, status: HttpStatus.NOT_FOUND },
	rollbackBlockedSections: { key: E.rollbackBlockedSections, status: HttpStatus.CONFLICT },
	rollbackBlockedOutcomes: { key: E.rollbackBlockedOutcomes, status: HttpStatus.CONFLICT },
	rollbackBlockedProfessors: { key: E.rollbackBlockedProfessors, status: HttpStatus.CONFLICT },
	rollbackBlockedStaff: { key: E.rollbackBlockedStaff, status: HttpStatus.CONFLICT },
	rollbackBlockedNewerUpload: { key: E.rollbackBlockedNewerUpload, status: HttpStatus.CONFLICT },
};

export const LEGACY_UPLOAD_TYPE_CODES: Record<string, string> = {
	MALLA_CURRICULAR: TYPE_CODES.UPLOAD_TYPE.STUDY_PLAN,
	MALLA_COCOS: TYPE_CODES.UPLOAD_TYPE.OUTCOMES,
	ORGANIGRAMA: TYPE_CODES.UPLOAD_TYPE.ORGANIZATION_CHART,
	SECCION: TYPE_CODES.UPLOAD_TYPE.SECTIONS,
	ALUMNOS_MATRICULADOS: TYPE_CODES.UPLOAD_TYPE.ENROLLED_STUDENTS,
	NOTASRC: TYPE_CODES.UPLOAD_TYPE.RC_GRADES,
	ALUMNOS_POR_SECCION: TYPE_CODES.UPLOAD_TYPE.STUDENT_SECTION_ENROLLMENT,
};
