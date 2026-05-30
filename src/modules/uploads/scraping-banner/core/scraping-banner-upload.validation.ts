import { ScrapingBannerRow } from '../model/scraping-banner-upload.types';
import { scrapingBannerUploadStrings } from '../config/strings/scraping-banner-upload.validation';

export interface ScrapingBannerLookups {
	programIdByCode: Map<string, number>;
	academicPeriodIdByCode: Map<string, number>;
	campusIdByCode: Map<string, number>;
	courseIdByCode: Map<string, number>;
	professorIdByCode: Map<string, number>;
	modalityTypeIdByCode: Map<string, number>; // core.types/MODALITY_TYPE
}

export interface ResolvedScrapingBannerRow {
	rowNumber: number;
	errors: string[];
	studentCode?: string;
	firstName?: string;
	lastName?: string;
	email?: string;
	programId?: number;
	academicPeriodId?: number;
	campusId?: number;
	courseId?: number;
	professorId?: number;
	graduationModalityId?: number;
	enrollmentModalityId?: number;
	sectionCode?: string;
}

export class ScrapingBannerUploadValidation {
	static validateRow(row: ScrapingBannerRow, lookups: ScrapingBannerLookups, fallbackAcademicPeriodId: number): ResolvedScrapingBannerRow {
		const errors: string[] = [];

		const studentCode = (row.studentCode ?? '').trim();
		const programId = lookups.programIdByCode.get((row.programCode ?? '').trim());
		const academicPeriodId = row.academicPeriodCode ? lookups.academicPeriodIdByCode.get(row.academicPeriodCode.trim()) : fallbackAcademicPeriodId;
		const campusId = lookups.campusIdByCode.get((row.campusCode ?? '').trim());
		const courseId = lookups.courseIdByCode.get((row.courseCodeFull ?? '').trim());
		const professorId = lookups.professorIdByCode.get((row.professorCode ?? '').trim());
		const graduationModalityId = lookups.modalityTypeIdByCode.get((row.graduationModalityCode ?? '').trim().toUpperCase());
		const enrollmentModalityId = lookups.modalityTypeIdByCode.get((row.enrollmentModalityCode ?? '').trim().toUpperCase());
		const sectionCode = (row.sectionCode ?? '').trim();

		if (studentCode === '') errors.push(scrapingBannerUploadStrings.error.studentCodeEmpty);
		if (programId === undefined) errors.push(scrapingBannerUploadStrings.error.programNotFound);
		if (academicPeriodId === undefined) errors.push(scrapingBannerUploadStrings.error.academicPeriodNotFound);
		if (campusId === undefined) errors.push(scrapingBannerUploadStrings.error.campusNotFound);
		if (courseId === undefined) errors.push(scrapingBannerUploadStrings.error.courseNotFound);
		if (professorId === undefined) errors.push(scrapingBannerUploadStrings.error.professorNotFound);
		if (graduationModalityId === undefined) errors.push(scrapingBannerUploadStrings.error.graduationModalityInvalid);
		if (enrollmentModalityId === undefined) errors.push(scrapingBannerUploadStrings.error.enrollmentModalityInvalid);
		if (sectionCode === '') errors.push(scrapingBannerUploadStrings.error.sectionCodeEmpty);

		return {
			rowNumber: row.rowNumber,
			errors,
			studentCode,
			firstName: (row.firstName ?? '').trim(),
			lastName: (row.lastName ?? '').trim(),
			email: ((row.institutionalEmail || row.personalEmail) ?? '').trim(),
			programId,
			academicPeriodId,
			campusId,
			courseId,
			professorId,
			graduationModalityId,
			enrollmentModalityId,
			sectionCode,
		};
	}

	static validateAll(rows: ScrapingBannerRow[], lookups: ScrapingBannerLookups, fallbackAcademicPeriodId: number): ResolvedScrapingBannerRow[] {
		return rows.map((row) => this.validateRow(row, lookups, fallbackAcademicPeriodId));
	}
}
