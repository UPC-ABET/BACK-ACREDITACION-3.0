import { GradesBannerRow, parseGrade, parseWeight } from '../model/grades-banner-upload.types';
import { gradesBannerUploadStrings } from '../config/strings/grades-banner-upload.validation';

export interface GradesBannerLookups {
	sseIdByKey: Map<string, number>;          // `${courseCode}|${sectionCode}|${studentCode}` → SSE.id
	gradeTypeIdByCode: Map<string, number>;   // core.types/GRADE_TYPE.code → id
	existingGradeKeys: Set<string>;           // `${sseId}|${gradeTypeId}` ya registrados
}

export interface ResolvedGradesBannerRow {
	rowNumber: number;
	errors: string[];
	sseId?: number;
	gradeTypeId?: number;
	grade?: number;
	weight?: number;
}

export class GradesBannerUploadValidation {
	static validateRow(row: GradesBannerRow, lookups: GradesBannerLookups): ResolvedGradesBannerRow {
		const errors: string[] = [];

		const studentCode = (row.studentCode ?? '').trim();
		const courseCode = (row.courseCode ?? '').trim();
		const sectionCode = (row.sectionCode ?? '').trim();
		const sseId = lookups.sseIdByKey.get(`${courseCode}|${sectionCode}|${studentCode}`);
		const gradeTypeId = lookups.gradeTypeIdByCode.get((row.gradeTypeCode ?? '').trim().toUpperCase());
		const grade = parseGrade(row.grade);
		const weight = parseWeight(row.weight);

		if (studentCode === '') errors.push(gradesBannerUploadStrings.error.studentCodeEmpty);
		if (courseCode === '') errors.push(gradesBannerUploadStrings.error.courseCodeEmpty);
		if (sectionCode === '') errors.push(gradesBannerUploadStrings.error.sectionCodeEmpty);
		if (studentCode !== '' && courseCode !== '' && sectionCode !== '' && sseId === undefined) {
			errors.push(gradesBannerUploadStrings.error.enrollmentNotFound);
		}
		if (gradeTypeId === undefined) errors.push(gradesBannerUploadStrings.error.gradeTypeInvalid);
		if (grade === null) errors.push(gradesBannerUploadStrings.error.gradeInvalid);

		if (sseId !== undefined && gradeTypeId !== undefined && lookups.existingGradeKeys.has(`${sseId}|${gradeTypeId}`)) {
			errors.push(gradesBannerUploadStrings.error.gradeAlreadyExists);
		}

		return {
			rowNumber: row.rowNumber,
			errors,
			sseId,
			gradeTypeId,
			grade: grade ?? undefined,
			weight: weight ?? undefined,
		};
	}

	static validateAll(rows: GradesBannerRow[], lookups: GradesBannerLookups): ResolvedGradesBannerRow[] {
		return rows.map((row) => this.validateRow(row, lookups));
	}
}
