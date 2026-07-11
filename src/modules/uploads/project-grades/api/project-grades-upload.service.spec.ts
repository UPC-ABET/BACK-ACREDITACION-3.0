import * as ExcelJS from 'exceljs';
import { ProjectGradesUploadService } from './project-grades-upload.service';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';

const CAPSTONE_TYPE_ID = 100;
const NON_CAPSTONE_TYPE_ID = 101;
const MULTIPLE_SCOPE_ID = 200;
const SINGLE_SCOPE_ID = 201;
const GRADE_TYPE_ID = 300;
const PERF_LEVEL_INSTRUMENT_ID = 500;
const ASISTIO_STATUS = { id: 400, code: TYPE_CODES.QUALIFICATION_STATUS.ASISTIO };
const NR_STATUS = { id: 401, code: TYPE_CODES.QUALIFICATION_STATUS.NR };

const modeARubric: any = {
	id: 1,
	rubricTypeId: CAPSTONE_TYPE_ID,
	competencyScopeTypeId: MULTIPLE_SCOPE_ID,
	questions: [
		{
			id: 1,
			outcomeId: 10,
			outcome: { id: 10, outcomeCode: 'RA1' },
			criterias: [
				{ id: 101, minValue: 1, maxValue: 1 },
				{ id: 102, minValue: 2, maxValue: 2 },
				{ id: 103, minValue: 3, maxValue: 3 },
			],
		},
		{
			id: 2,
			outcomeId: 11,
			outcome: { id: 11, outcomeCode: 'RA2' },
			criterias: [
				{ id: 104, minValue: 1, maxValue: 1 },
				{ id: 105, minValue: 2, maxValue: 2 },
			],
		},
	],
};

const modeBRubric: any = {
	id: 2,
	rubricTypeId: NON_CAPSTONE_TYPE_ID,
	competencyScopeTypeId: SINGLE_SCOPE_ID,
	questions: [
		{
			id: 1,
			outcomeId: null,
			outcome: null,
			criterias: [
				{ id: 201, minValue: 1, maxValue: 2 },
				{ id: 202, minValue: 3, maxValue: 4 },
				{ id: 203, minValue: 5, maxValue: 6 },
			],
		},
	],
};

const project: any = {
	id: 1,
	code: 'PROY-001',
	students: [
		{
			id: 55,
			studentSectionEnrollmentId: 555,
			studentSectionEnrollment: {
				courseSection: { courseId: 9 },
				enrolledStudent: {
					studyPlanAcademicPeriodId: 77,
					studyPlanAcademicPeriod: { academicPeriodId: 1 },
					student: { code: '2025001' },
				},
			},
		},
	],
	evaluators: [
		{
			id: 77,
			professorId: 88,
			isActive: true,
			evaluatorType: { extra: { canEvaluate: true } },
		},
	],
};

const professor: any = { id: 88, code: 'N001' };
const performanceLevels = [{ uniqueValue: 1 }, { uniqueValue: 2 }, { uniqueValue: 3 }];

function makeRepository(rubric: any, status: { id: number; code: string } = ASISTIO_STATUS) {
	return {
		findAcademicPeriodByCode: jest.fn().mockResolvedValue({ id: 1, code: '2025-1' }),
		findProjectByCode: jest.fn().mockResolvedValue(project),
		findTypeByCode: jest.fn().mockResolvedValue(status),
		findTypeIdByCode: jest.fn((code: string) => {
			const map: Record<string, number> = {
				[TYPE_CODES.RUBRIC_TYPE.CAPSTONE]: CAPSTONE_TYPE_ID,
				[TYPE_CODES.COMPETENCY_SCOPE.MULTIPLE]: MULTIPLE_SCOPE_ID,
				[TYPE_CODES.PERF_LEVEL_INSTRUMENT.TYPE]: PERF_LEVEL_INSTRUMENT_ID,
				GRADE_CODE: GRADE_TYPE_ID,
				SCOPE_CODE_SINGLE: SINGLE_SCOPE_ID,
			};
			return Promise.resolve(map[code] ?? null);
		}),
		findProfessorByCode: jest.fn().mockResolvedValue(professor),
		findRubric: jest.fn().mockResolvedValue(rubric),
		findPerformanceLevels: jest.fn().mockResolvedValue(performanceLevels),
		getGradeTypes: jest.fn().mockResolvedValue([]),
		getCompetencyScopeTypes: jest.fn().mockResolvedValue([]),
		getQualificationStatusTypes: jest.fn().mockResolvedValue([]),
	};
}

function makeEvaluationSubmissionService() {
	return {
		persistEvaluationScores: jest.fn().mockResolvedValue({ evaluationId: 1, scaledScore: 10 }),
		rollbackUpload: jest.fn().mockResolvedValue(undefined),
	};
}

function makeUploadLogService() {
	return {
		start: jest.fn().mockResolvedValue({ id: 999 }),
		assertRollbackable: jest.fn().mockResolvedValue(undefined),
		markRolledBack: jest.fn().mockResolvedValue(undefined),
	};
}

// Sheet B columns: scope(1) gradeType(2) period(3) project(4) student(5) evaluator(6) status(7)
// Q1..Q5 (8-12) observationEs(13) observationEn(14)
function buildRowB(fields: {
	scopeCode?: string;
	gradeTypeCode?: string;
	periodCode?: string;
	projectCode?: string;
	studentCode?: string;
	evaluatorCode?: string;
	statusCode?: string;
	questions?: string[];
	observationEs?: string;
	observationEn?: string;
}): string[] {
	const row = new Array(14).fill('');
	row[0] = fields.scopeCode ?? 'SCOPE_CODE_SINGLE';
	row[1] = fields.gradeTypeCode ?? 'GRADE_CODE';
	row[2] = fields.periodCode ?? '2025-1';
	row[3] = fields.projectCode ?? 'PROY-001';
	row[4] = fields.studentCode ?? '2025001';
	row[5] = fields.evaluatorCode ?? 'N001';
	row[6] = fields.statusCode ?? 'STATUS_CODE';
	(fields.questions ?? []).forEach((q, i) => (row[7 + i] = q));
	row[12] = fields.observationEs ?? '';
	row[13] = fields.observationEn ?? '';
	return row;
}

// Sheet A columns: gradeType(1) period(2) project(3) student(4) evaluator(5) status(6) outcomeCode(7)
// C1..C5 (8-12) observationEs(13) observationEn(14)
function buildRowA(fields: {
	gradeTypeCode?: string;
	periodCode?: string;
	projectCode?: string;
	studentCode?: string;
	evaluatorCode?: string;
	statusCode?: string;
	outcomeCode: string;
	criterias?: string[];
	observationEs?: string;
	observationEn?: string;
}): string[] {
	const row = new Array(14).fill('');
	row[0] = fields.gradeTypeCode ?? 'GRADE_CODE';
	row[1] = fields.periodCode ?? '2025-1';
	row[2] = fields.projectCode ?? 'PROY-001';
	row[3] = fields.studentCode ?? '2025001';
	row[4] = fields.evaluatorCode ?? 'N001';
	row[5] = fields.statusCode ?? 'STATUS_CODE';
	row[6] = fields.outcomeCode;
	(fields.criterias ?? []).forEach((c, i) => (row[7 + i] = c));
	row[12] = fields.observationEs ?? '';
	row[13] = fields.observationEn ?? '';
	return row;
}

async function makeXlsx(sheetBRows: string[][], sheetARows: string[][] = []): Promise<Buffer> {
	const wb = new ExcelJS.Workbook();
	const wsB = wb.addWorksheet('Preguntas');
	wsB.addRow(new Array(14).fill('header'));
	sheetBRows.forEach((r) => wsB.addRow(r));

	const wsA = wb.addWorksheet('Outcomes');
	wsA.addRow(new Array(14).fill('header'));
	sheetARows.forEach((r) => wsA.addRow(r));

	const buf = await wb.xlsx.writeBuffer();
	return Buffer.from(buf);
}

describe('ProjectGradesUploadService — Modo A (Capstone + Multiple, one row per outcome)', () => {
	it('groups rows by student and saves each criterion score positionally, validated against period performance levels', async () => {
		const repository = makeRepository(modeARubric);
		const evalService = makeEvaluationSubmissionService();
		const uploadLogService = makeUploadLogService();
		const service = new ProjectGradesUploadService(
			repository as any,
			evalService as any,
			uploadLogService as any,
		);

		const buffer = await makeXlsx(
			[],
			[
				buildRowA({ outcomeCode: 'RA1', criterias: ['1', '2', '3'] }),
				buildRowA({ outcomeCode: 'RA2', criterias: ['1', '2'] }),
			],
		);
		const result = await service.processUpload(buffer, 'grades.xlsx', 1, 1, {});

		expect(result.success).toBe(true);
		expect(result.loadedRows).toBe(1);
		expect(evalService.persistEvaluationScores).toHaveBeenCalledTimes(1);
		expect(evalService.persistEvaluationScores).toHaveBeenCalledWith(
			expect.objectContaining({
				isCapstoneMultiple: true,
				scoresToSave: expect.arrayContaining([
					{ rubricQuestionCriteriaId: 101, score: 1 },
					{ rubricQuestionCriteriaId: 102, score: 2 },
					{ rubricQuestionCriteriaId: 103, score: 3 },
					{ rubricQuestionCriteriaId: 104, score: 1 },
					{ rubricQuestionCriteriaId: 105, score: 2 },
				]),
			}),
		);
	});

	it('rejects a criterion score that is not a valid performance level for the period', async () => {
		const repository = makeRepository(modeARubric);
		const evalService = makeEvaluationSubmissionService();
		const uploadLogService = makeUploadLogService();
		const service = new ProjectGradesUploadService(
			repository as any,
			evalService as any,
			uploadLogService as any,
		);

		const buffer = await makeXlsx(
			[],
			[
				buildRowA({ outcomeCode: 'RA1', criterias: ['1', '2', '99'] }),
				buildRowA({ outcomeCode: 'RA2', criterias: ['1', '2'] }),
			],
		);
		const result = await service.processUpload(buffer, 'grades.xlsx', 1, 1, {});

		expect(result.success).toBe(false);
		expect(result.errorRows).toBe(1);
		expect(evalService.persistEvaluationScores).not.toHaveBeenCalled();
	});

	it('forces every criterion score to 0 when status is not ASISTIO, keeping the same criteria', async () => {
		const repository = makeRepository(modeARubric, NR_STATUS);
		const evalService = makeEvaluationSubmissionService();
		const uploadLogService = makeUploadLogService();
		const service = new ProjectGradesUploadService(
			repository as any,
			evalService as any,
			uploadLogService as any,
		);

		const buffer = await makeXlsx(
			[],
			[
				buildRowA({ statusCode: 'STATUS_CODE', outcomeCode: 'RA1', criterias: ['1', '2', '3'] }),
				buildRowA({ statusCode: 'STATUS_CODE', outcomeCode: 'RA2', criterias: ['1', '2'] }),
			],
		);
		const result = await service.processUpload(buffer, 'grades.xlsx', 1, 1, {});

		expect(result.success).toBe(true);
		expect(evalService.persistEvaluationScores).toHaveBeenCalledWith(
			expect.objectContaining({
				scoresToSave: expect.arrayContaining([
					{ rubricQuestionCriteriaId: 101, score: 0 },
					{ rubricQuestionCriteriaId: 102, score: 0 },
					{ rubricQuestionCriteriaId: 103, score: 0 },
					{ rubricQuestionCriteriaId: 104, score: 0 },
					{ rubricQuestionCriteriaId: 105, score: 0 },
				]),
			}),
		);
	});

	it('reports a chained error when an outcome mapped by the rubric is missing for the student', async () => {
		const repository = makeRepository(modeARubric);
		const evalService = makeEvaluationSubmissionService();
		const uploadLogService = makeUploadLogService();
		const service = new ProjectGradesUploadService(
			repository as any,
			evalService as any,
			uploadLogService as any,
		);

		const buffer = await makeXlsx(
			[],
			[buildRowA({ outcomeCode: 'RA1', criterias: ['1', '2', '3'] })],
		);
		const result = await service.processUpload(buffer, 'grades.xlsx', 1, 1, { lang: 'es' });

		expect(result.success).toBe(false);
		expect(result.errorRows).toBe(1);
		expect(evalService.persistEvaluationScores).not.toHaveBeenCalled();
	});

	it('writes the observation (shared across the student outcome rows) into the evaluation', async () => {
		const repository = makeRepository(modeARubric);
		const evalService = makeEvaluationSubmissionService();
		const uploadLogService = makeUploadLogService();
		const service = new ProjectGradesUploadService(
			repository as any,
			evalService as any,
			uploadLogService as any,
		);

		const buffer = await makeXlsx(
			[],
			[
				buildRowA({ outcomeCode: 'RA1', criterias: ['1', '2', '3'] }),
				buildRowA({ outcomeCode: 'RA2', criterias: ['1', '2'], observationEs: 'Bien' }),
			],
		);
		await service.processUpload(buffer, 'grades.xlsx', 1, 1, {});

		expect(evalService.persistEvaluationScores).toHaveBeenCalledWith(
			expect.objectContaining({ observation: { es: 'Bien', en: '' } }),
		);
	});
});

describe('ProjectGradesUploadService — Modo B (range matching)', () => {
	it('matches the number to the criterion whose range contains it (boundary value)', async () => {
		const repository = makeRepository(modeBRubric);
		const evalService = makeEvaluationSubmissionService();
		const uploadLogService = makeUploadLogService();
		const service = new ProjectGradesUploadService(
			repository as any,
			evalService as any,
			uploadLogService as any,
		);

		const buffer = await makeXlsx([buildRowB({ questions: ['5'] })]);
		const result = await service.processUpload(buffer, 'grades.xlsx', 1, 1, {});

		expect(result.success).toBe(true);
		expect(evalService.persistEvaluationScores).toHaveBeenCalledWith(
			expect.objectContaining({
				isCapstoneMultiple: false,
				scoresToSave: [{ rubricQuestionCriteriaId: 203, score: 5 }],
			}),
		);
	});

	it('forces the lowest-range criterion with score 0 when status is not ASISTIO, ignoring the typed number', async () => {
		const repository = makeRepository(modeBRubric, NR_STATUS);
		const evalService = makeEvaluationSubmissionService();
		const uploadLogService = makeUploadLogService();
		const service = new ProjectGradesUploadService(
			repository as any,
			evalService as any,
			uploadLogService as any,
		);

		const buffer = await makeXlsx([buildRowB({ questions: ['5'] })]);
		const result = await service.processUpload(buffer, 'grades.xlsx', 1, 1, {});

		expect(result.success).toBe(true);
		expect(evalService.persistEvaluationScores).toHaveBeenCalledWith(
			expect.objectContaining({
				scoresToSave: [{ rubricQuestionCriteriaId: 201, score: 0 }],
			}),
		);
	});

	it('rejects a score that does not fall in any criterion range', async () => {
		const repository = makeRepository(modeBRubric);
		const evalService = makeEvaluationSubmissionService();
		const uploadLogService = makeUploadLogService();
		const service = new ProjectGradesUploadService(
			repository as any,
			evalService as any,
			uploadLogService as any,
		);

		const buffer = await makeXlsx([buildRowB({ questions: ['99'] })]);
		const result = await service.processUpload(buffer, 'grades.xlsx', 1, 1, {});

		expect(result.success).toBe(false);
		expect(result.errorRows).toBe(1);
		expect(evalService.persistEvaluationScores).not.toHaveBeenCalled();
	});

	it('sends the observation only when at least one language is filled', async () => {
		const repository = makeRepository(modeBRubric);
		const evalService = makeEvaluationSubmissionService();
		const uploadLogService = makeUploadLogService();
		const service = new ProjectGradesUploadService(
			repository as any,
			evalService as any,
			uploadLogService as any,
		);

		const buffer = await makeXlsx([buildRowB({ questions: ['5'], observationEs: 'Bien' })]);
		await service.processUpload(buffer, 'grades.xlsx', 1, 1, {});

		expect(evalService.persistEvaluationScores).toHaveBeenCalledWith(
			expect.objectContaining({ observation: { es: 'Bien', en: '' } }),
		);
	});

	it('rejects a row whose scope resolves to Capstone + Multiple (must use the other sheet)', async () => {
		const repository = makeRepository(modeARubric);
		const evalService = makeEvaluationSubmissionService();
		const uploadLogService = makeUploadLogService();
		const service = new ProjectGradesUploadService(
			repository as any,
			evalService as any,
			uploadLogService as any,
		);

		const buffer = await makeXlsx([
			buildRowB({ scopeCode: TYPE_CODES.COMPETENCY_SCOPE.MULTIPLE, questions: ['5'] }),
		]);
		const result = await service.processUpload(buffer, 'grades.xlsx', 1, 1, {});

		expect(result.success).toBe(false);
		expect(evalService.persistEvaluationScores).not.toHaveBeenCalled();
	});
});
