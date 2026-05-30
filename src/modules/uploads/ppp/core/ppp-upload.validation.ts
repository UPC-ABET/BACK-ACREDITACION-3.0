import { PppRow, parseScore } from '../model/ppp-upload.types';
import { pppUploadStrings } from '../config/strings/ppp-upload.validation';

export interface PppLookups {
	surveyTypeIdByCode: Map<string, number>;        // core.types/SURVEY_TYPE
	surveyStatusTypeIdByCode: Map<string, number>;  // core.types/SURVEY_STATUS
	studentIdByCode: Map<string, number>;           // academic.students via users.code
	academicPeriodIdByCode: Map<string, number>;
	campusIdByCode: Map<string, number>;
	programIdByCode: Map<string, number>;
	outcomeIdByKey: Map<string, number>;            // `${outcomeCode}|${programCode}` → accreditation.outcomes.id (matching frágil — Bug #15)
}

export interface ResolvedPppRow {
	rowNumber: number;
	errors: string[];
	surveyTypeId?: number;
	surveyStatusTypeId?: number;
	studentId?: number;
	academicPeriodId?: number;
	campusId?: number;
	programId?: number;
	surveyNumber?: string;
	outcomeId?: number;
	score?: number;
}

export class PppUploadValidation {
	static validateRow(row: PppRow, lookups: PppLookups): ResolvedPppRow {
		const errors: string[] = [];

		const surveyTypeId = lookups.surveyTypeIdByCode.get((row.surveyTypeCode ?? '').trim().toUpperCase());
		const status = (row.surveyStatusCode ?? '').trim().toUpperCase();
		const statusKey = status === 'ACT' ? 'SURVEY_ACTIVE' : status === 'INA' ? 'SURVEY_INACTIVE' : status;
		const surveyStatusTypeId = lookups.surveyStatusTypeIdByCode.get(statusKey);
		const studentId = lookups.studentIdByCode.get((row.studentCode ?? '').trim());
		const academicPeriodId = lookups.academicPeriodIdByCode.get((row.academicPeriodCode ?? '').trim());
		const campusId = lookups.campusIdByCode.get((row.campusCode ?? '').trim());
		const programId = lookups.programIdByCode.get((row.programCode ?? '').trim());
		const surveyNumber = (row.surveyNumber ?? '').trim();
		const outcomeCode = (row.outcomeCode ?? '').trim();
		const programCode = (row.programCode ?? '').trim();
		const outcomeId = lookups.outcomeIdByKey.get(`${outcomeCode}|${programCode}`);
		const score = parseScore(row.score);

		if (surveyTypeId === undefined) errors.push(pppUploadStrings.error.surveyTypeInvalid);
		if (surveyStatusTypeId === undefined) errors.push(pppUploadStrings.error.surveyStatusInvalid);
		if (studentId === undefined) errors.push(pppUploadStrings.error.studentNotFound);
		if (academicPeriodId === undefined) errors.push(pppUploadStrings.error.academicPeriodNotFound);
		if (campusId === undefined) errors.push(pppUploadStrings.error.campusNotFound);
		if (programId === undefined) errors.push(pppUploadStrings.error.programNotFound);
		if (surveyNumber === '') errors.push(pppUploadStrings.error.surveyNumberEmpty);
		if (outcomeId === undefined) errors.push(pppUploadStrings.error.outcomeNotFound);
		if (score === null) errors.push(pppUploadStrings.error.scoreInvalid);

		return {
			rowNumber: row.rowNumber,
			errors,
			surveyTypeId,
			surveyStatusTypeId,
			studentId,
			academicPeriodId,
			campusId,
			programId,
			surveyNumber,
			outcomeId,
			score: score ?? undefined,
		};
	}

	static validateAll(rows: PppRow[], lookups: PppLookups): ResolvedPppRow[] {
		return rows.map((row) => this.validateRow(row, lookups));
	}
}
