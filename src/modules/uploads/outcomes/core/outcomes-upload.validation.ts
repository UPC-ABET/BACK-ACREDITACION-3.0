import { OutcomeRow } from '../model/outcomes-upload.types';
import { outcomesUploadStrings } from '../config/strings/outcomes-upload.validation';

// Lookups pre-cargados con queries set-based.
export interface OutcomesLookups {
	programIdByCode: Map<string, number>;                    // academic.programs.code → id
	spcIdByPlanCourse: Map<string, number>;                  // `${studyPlanCode}|${courseCode}` → study_plan_courses.id (en el período)
	outcomeTypeIdByCode: Map<string, number>;                // core.types/OUTCOME_COURSE_TYPE.code → id (CONTROL/VERIFICACION)
	existingMappingKeys: Set<string>;                        // `${outcomeCode}|${spcId}` ya mapeados
}

export interface ResolvedOutcomeRow {
	rowNumber: number;
	errors: string[];
	accreditorCode?: string;
	commissionCode?: string;
	programId?: number;
	spcId?: number;
	outcomeCode?: string;
	outcomeTypeId?: number;
}

export class OutcomesUploadValidation {
	static validateRow(row: OutcomeRow, lookups: OutcomesLookups): ResolvedOutcomeRow {
		const errors: string[] = [];

		const accreditorCode = (row.accreditorCode ?? '').trim();
		const commissionCode = (row.commissionCode ?? '').trim();
		const programId = lookups.programIdByCode.get((row.programCode ?? '').trim());
		const planCode = (row.studyPlanCode ?? '').trim();
		const courseCode = (row.courseCode ?? '').trim();
		const spcId = lookups.spcIdByPlanCourse.get(`${planCode}|${courseCode}`);
		const outcomeCode = (row.outcomeCode ?? '').trim();
		const outcomeTypeId = lookups.outcomeTypeIdByCode.get((row.outcomeTypeCode ?? '').trim().toUpperCase());

		if (accreditorCode === '') errors.push(outcomesUploadStrings.error.accreditorCodeEmpty);
		if (commissionCode === '') errors.push(outcomesUploadStrings.error.commissionCodeEmpty);
		if (programId === undefined) errors.push(outcomesUploadStrings.error.programNotFound);
		if (spcId === undefined) errors.push(outcomesUploadStrings.error.studyPlanCourseNotFound);
		if (outcomeCode === '') errors.push(outcomesUploadStrings.error.outcomeCodeEmpty);
		if (outcomeTypeId === undefined) errors.push(outcomesUploadStrings.error.outcomeTypeInvalid);

		if (outcomeCode !== '' && spcId !== undefined && lookups.existingMappingKeys.has(`${outcomeCode}|${spcId}`)) {
			errors.push(outcomesUploadStrings.error.outcomeAlreadyMapped);
		}

		return { rowNumber: row.rowNumber, errors, accreditorCode, commissionCode, programId, spcId, outcomeCode, outcomeTypeId };
	}

	static validateAll(rows: OutcomeRow[], lookups: OutcomesLookups): ResolvedOutcomeRow[] {
		return rows.map((row) => this.validateRow(row, lookups));
	}
}
