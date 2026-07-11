import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

import { readCell } from 'src/libs/excel.functions';
import { addReferenceTable } from 'src/libs/excel-reference-table.functions';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import { RubricEntity } from 'src/modules/evaluation/rubrics/model/rubrics.entity';
import { EvaluationSubmissionService } from 'src/modules/evidence/evaluations/api/evaluation-submission.service';
import { UploadLogService } from '../../upload-logs/api/upload-logs.service';
import type { I18nText } from 'src/shared/types/i18n';

import {
	MAX_CRITERIA_SLOTS,
	MAX_QUESTION_SLOTS,
	ProjectGradeRowA,
	ProjectGradeRowB,
	UploadResult,
	UploadRowError,
} from '../model/project-grades-upload.types';
import type { ProjectGradesUploadDto } from '../model/project-grades-upload.dtos';
import {
	DEFAULT_TEMPLATE_LANGUAGE,
	projectGradesErrorMessages,
	projectGradesSheetAInstructions,
	projectGradesSheetBInstructions,
	projectGradesTemplateLabels,
} from '../model/project-grades-template.labels';
import { ProjectGradesUploadRepository } from '../core/project-grades-upload.repository';

interface PendingPersist {
	projectStudentId: number;
	projectEvaluatorId: number;
	studentSectionEnrollmentId: number;
	rubric: RubricEntity;
	isCapstoneMultiple: boolean;
	observation: I18nText | undefined;
	qualificationStatusTypeId: number;
	scoresToSave: Array<{ rubricQuestionCriteriaId: number; score: number }>;
	criteriaToQuestion: Map<number, number>;
}

// Sheet B (Modo B — everything except Capstone+Multiple): one row per student.
// Columns: scope(1) gradeType(2) period(3) project(4) student(5) evaluator(6) status(7)
// + Q1..Q5 (8-12) + observationEs(13) + observationEn(14)
const B_FIXED_COLUMNS = 7;
const B_QUESTION_START = B_FIXED_COLUMNS + 1;
const B_OBSERVATION_ES_COLUMN = B_QUESTION_START + MAX_QUESTION_SLOTS;
const B_OBSERVATION_EN_COLUMN = B_OBSERVATION_ES_COLUMN + 1;
const B_ERROR_COLUMN = B_OBSERVATION_EN_COLUMN + 1;

// Sheet A (Modo A — Capstone+Multiple): one row per (student, outcome).
// Columns: gradeType(1) period(2) project(3) student(4) evaluator(5) status(6) outcomeCode(7)
// + C1..C5 (8-12) + observationEs(13) + observationEn(14)
const A_FIXED_COLUMNS = 7;
const A_CRITERIA_START = A_FIXED_COLUMNS + 1;
const A_OBSERVATION_ES_COLUMN = A_CRITERIA_START + MAX_CRITERIA_SLOTS;
const A_OBSERVATION_EN_COLUMN = A_OBSERVATION_ES_COLUMN + 1;
const A_ERROR_COLUMN = A_OBSERVATION_EN_COLUMN + 1;

interface ResolvedIdentity {
	rubric: RubricEntity;
	isCapstoneMultiple: boolean;
	projectStudentId: number;
	studentSectionEnrollmentId: number;
	projectEvaluatorId: number;
	qualificationStatusTypeId: number;
	isNonAttendanceStatus: boolean;
}

@Injectable()
export class ProjectGradesUploadService {
	constructor(
		private readonly repository: ProjectGradesUploadRepository,
		private readonly evaluationSubmissionService: EvaluationSubmissionService,
		private readonly uploadLogService: UploadLogService,
	) {}

	/**
	 * Two-phase: every row/group is validated and resolved into a `PendingPersist` descriptor
	 * first, with zero DB writes. Only if the whole file is error-free do we open the upload log
	 * and persist everything — otherwise a row that happened to be processed early could get written
	 * even though the overall response reports failure.
	 */
	async processUpload(
		fileBuffer: Buffer,
		fileName: string,
		userId: number,
		academicPeriodId: number,
		dto: ProjectGradesUploadDto,
	): Promise<UploadResult> {
		const language = this.resolveLanguage(dto.lang);
		const labels = projectGradesTemplateLabels[language];
		const messages = projectGradesErrorMessages[language];

		const workbook = new ExcelJS.Workbook();
		await workbook.xlsx.load(fileBuffer as unknown as ArrayBuffer);

		const sheetBRows = this.parseSheetB(workbook, labels);
		const sheetARows = this.parseSheetA(workbook, labels);

		const rowErrors: UploadRowError[] = [];
		const pendings: PendingPersist[] = [];
		let totalRows = sheetBRows.length;

		for (const row of sheetBRows) {
			const result = await this.resolveRowB(row);
			if ('errors' in result) {
				rowErrors.push({ sheet: 'B', rowNumber: row.rowNumber, errorCodes: result.errors });
			} else {
				pendings.push(result.pending);
			}
		}

		const groups = this.groupSheetARows(sheetARows);
		totalRows += groups.length;
		for (const group of groups) {
			const result = await this.resolveGroupA(group);
			if ('errorsByRow' in result) {
				for (const [rowNumber, errorCodes] of result.errorsByRow) {
					rowErrors.push({ sheet: 'A', rowNumber, errorCodes });
				}
			} else {
				pendings.push(result.pending);
			}
		}

		if (rowErrors.length > 0) {
			const excel = await this.annotateErrors(workbook, labels, rowErrors, messages);
			return {
				success: false,
				uploadLogId: null,
				totalRows,
				loadedRows: 0,
				errorRows: rowErrors.length,
				excelWithErrors: excel,
				fileName: labels.errorsFileName,
			};
		}

		const uploadLog = await this.uploadLogService.start({
			user_id: userId,
			academic_period_id: academicPeriodId,
			upload_type: TYPE_CODES.UPLOAD_TYPE.PROJECT_GRADES,
			status: TYPE_CODES.UPLOAD_STATUS.COMPLETED,
			source_file: fileName,
			total_rows: totalRows,
			loaded_rows: pendings.length,
			error_rows: 0,
		});

		for (const pending of pendings) {
			await this.evaluationSubmissionService.persistEvaluationScores({
				...pending,
				uploadLogId: uploadLog.id,
			});
		}

		return {
			success: true,
			uploadLogId: uploadLog.id,
			totalRows,
			loadedRows: pendings.length,
			errorRows: 0,
			excelWithErrors: null,
			fileName: null,
		};
	}

	async rollback(uploadLogId: number): Promise<{ success: boolean }> {
		await this.uploadLogService.assertRollbackable(uploadLogId);
		await this.evaluationSubmissionService.rollbackUpload(uploadLogId);
		await this.uploadLogService.markRolledBack(uploadLogId);
		return { success: true };
	}

	// ── Modo B ──────────────────────────────────────────────────────────────

	private async resolveRowB(
		row: ProjectGradeRowB,
	): Promise<{ errors: string[] } | { pending: PendingPersist }> {
		const identityErrors: string[] = [];
		if (!row.academicPeriodCode) identityErrors.push('academicPeriodCodeEmpty');
		if (!row.projectCode) identityErrors.push('projectCodeEmpty');
		if (!row.studentCode) identityErrors.push('studentCodeEmpty');
		if (!row.evaluatorCode) identityErrors.push('evaluatorCodeEmpty');
		if (!row.statusCode) identityErrors.push('statusCodeEmpty');
		if (!row.gradeTypeCode) identityErrors.push('gradeTypeCodeEmpty');
		if (!row.competencyScopeCode) identityErrors.push('competencyScopeCodeEmpty');
		if (identityErrors.length > 0) return { errors: identityErrors };

		const resolved = await this.resolveIdentity({
			academicPeriodCode: row.academicPeriodCode,
			projectCode: row.projectCode,
			studentCode: row.studentCode,
			evaluatorCode: row.evaluatorCode,
			statusCode: row.statusCode,
			gradeTypeCode: row.gradeTypeCode,
			competencyScopeCode: row.competencyScopeCode,
		});
		if ('errors' in resolved) return { errors: resolved.errors };
		if (resolved.isCapstoneMultiple) return { errors: ['competencyScopeNotAllowedHere'] };

		const errors: string[] = [];
		const questions = [...(resolved.rubric.questions ?? [])].sort((a, b) => a.id - b.id);
		if (questions.length > MAX_QUESTION_SLOTS) {
			return { errors: ['tooManyQuestionsForTemplate'] };
		}

		const scoresToSave: Array<{ rubricQuestionCriteriaId: number; score: number }> = [];

		questions.forEach((question, index) => {
			const criterias = question.criterias ?? [];

			if (resolved.isNonAttendanceStatus) {
				const lowest = [...criterias].sort((a, b) => Number(a.minValue) - Number(b.minValue))[0];
				if (!lowest) {
					errors.push('questionNoCriteria');
					return;
				}
				scoresToSave.push({ rubricQuestionCriteriaId: lowest.id, score: 0 });
				return;
			}

			const raw = row.questions[index];
			if (!raw) {
				errors.push('questionScoreMissing');
				return;
			}
			const num = Number(raw);
			if (Number.isNaN(num)) {
				errors.push('questionScoreInvalid');
				return;
			}
			const criteria = criterias.find(
				(c) => num >= Number(c.minValue) && num <= Number(c.maxValue),
			);
			if (!criteria) {
				errors.push('questionScoreOutOfRange');
				return;
			}
			scoresToSave.push({ rubricQuestionCriteriaId: criteria.id, score: num });
		});

		for (let i = questions.length; i < row.questions.length; i++) {
			if (row.questions[i]) errors.push('questionSlotUnused');
		}

		if (errors.length > 0) return { errors };

		const observation = this.buildObservation(row.observationEs, row.observationEn);
		const criteriaToQuestion = this.buildCriteriaToQuestionMap(resolved.rubric);

		return {
			pending: {
				projectStudentId: resolved.projectStudentId,
				projectEvaluatorId: resolved.projectEvaluatorId,
				studentSectionEnrollmentId: resolved.studentSectionEnrollmentId,
				rubric: resolved.rubric,
				isCapstoneMultiple: false,
				observation,
				qualificationStatusTypeId: resolved.qualificationStatusTypeId,
				scoresToSave,
				criteriaToQuestion,
			},
		};
	}

	// ── Modo A ──────────────────────────────────────────────────────────────

	/** Groups Sheet A rows (one row per outcome) by the student they belong to. */
	private groupSheetARows(rows: ProjectGradeRowA[]): ProjectGradeRowA[][] {
		const groups = new Map<string, ProjectGradeRowA[]>();
		for (const row of rows) {
			const key = `${row.projectCode}|${row.studentCode}|${row.gradeTypeCode}|${row.academicPeriodCode}`;
			const list = groups.get(key) ?? [];
			list.push(row);
			groups.set(key, list);
		}
		return [...groups.values()];
	}

	private async resolveGroupA(
		rows: ProjectGradeRowA[],
	): Promise<{ errorsByRow: Map<number, string[]> } | { pending: PendingPersist }> {
		const errorsByRow = new Map<number, string[]>();
		const pushError = (rowNumber: number, code: string) => {
			const list = errorsByRow.get(rowNumber) ?? [];
			list.push(code);
			errorsByRow.set(rowNumber, list);
		};

		const first = rows[0];
		const identityErrors: string[] = [];
		if (!first.academicPeriodCode) identityErrors.push('academicPeriodCodeEmpty');
		if (!first.projectCode) identityErrors.push('projectCodeEmpty');
		if (!first.studentCode) identityErrors.push('studentCodeEmpty');
		if (!first.evaluatorCode) identityErrors.push('evaluatorCodeEmpty');
		if (!first.statusCode) identityErrors.push('statusCodeEmpty');
		if (!first.gradeTypeCode) identityErrors.push('gradeTypeCodeEmpty');
		if (identityErrors.length > 0) {
			for (const code of identityErrors) pushError(first.rowNumber, code);
			return { errorsByRow };
		}

		for (const row of rows) {
			if (row.evaluatorCode !== first.evaluatorCode)
				pushError(row.rowNumber, 'evaluatorCodeInconsistent');
			if (row.statusCode !== first.statusCode) pushError(row.rowNumber, 'statusCodeInconsistent');
			if (!row.outcomeCode) pushError(row.rowNumber, 'outcomeCodeEmpty');
		}
		if (errorsByRow.size > 0) return { errorsByRow };

		const resolved = await this.resolveIdentity({
			academicPeriodCode: first.academicPeriodCode,
			projectCode: first.projectCode,
			studentCode: first.studentCode,
			evaluatorCode: first.evaluatorCode,
			statusCode: first.statusCode,
			gradeTypeCode: first.gradeTypeCode,
			competencyScopeCode: TYPE_CODES.COMPETENCY_SCOPE.MULTIPLE,
		});
		if ('errors' in resolved) {
			for (const code of resolved.errors) pushError(first.rowNumber, code);
			return { errorsByRow };
		}
		if (!resolved.isCapstoneMultiple) {
			pushError(first.rowNumber, 'rubricNotFound');
			return { errorsByRow };
		}

		const questionsByOutcomeCode = new Map<string, (typeof resolved.rubric.questions)[number]>();
		for (const question of resolved.rubric.questions ?? []) {
			if (question.outcome) questionsByOutcomeCode.set(question.outcome.outcomeCode, question);
		}

		const performanceLevels = await this.getValidPerformanceLevelValues(
			resolved.rubric,
			first.academicPeriodCode,
		);
		if (performanceLevels === null) {
			pushError(first.rowNumber, 'performanceLevelsNotConfigured');
			return { errorsByRow };
		}

		const scoresToSave: Array<{ rubricQuestionCriteriaId: number; score: number }> = [];
		const seenOutcomeCodes = new Set<string>();
		let observation: { es: string; en: string } | undefined;

		for (const row of rows) {
			const rowObservation = this.buildObservation(row.observationEs, row.observationEn);
			if (rowObservation) observation = rowObservation;

			if (!row.outcomeCode) continue; // already reported above

			const question = questionsByOutcomeCode.get(row.outcomeCode);
			if (!question) {
				pushError(row.rowNumber, 'outcomeCodeNotFound');
				continue;
			}
			if (seenOutcomeCodes.has(row.outcomeCode)) {
				pushError(row.rowNumber, 'outcomeDuplicated');
				continue;
			}
			seenOutcomeCodes.add(row.outcomeCode);

			const criterias = [...(question.criterias ?? [])].sort((a, b) => a.id - b.id);
			if (criterias.length > MAX_CRITERIA_SLOTS) {
				pushError(row.rowNumber, 'tooManyCriteriasForTemplate');
				continue;
			}

			let scoredAny = false;
			criterias.forEach((criteria, index) => {
				const raw = row.criterias[index];
				if (!raw) return;
				scoredAny = true;

				if (resolved.isNonAttendanceStatus) {
					scoresToSave.push({ rubricQuestionCriteriaId: criteria.id, score: 0 });
					return;
				}

				const num = Number(raw);
				if (Number.isNaN(num)) {
					pushError(row.rowNumber, 'criteriaScoreInvalid');
					return;
				}
				if (!performanceLevels.has(num)) {
					pushError(row.rowNumber, 'criteriaScoreNotValidLevel');
					return;
				}
				scoresToSave.push({ rubricQuestionCriteriaId: criteria.id, score: num });
			});

			for (let i = criterias.length; i < row.criterias.length; i++) {
				if (row.criterias[i]) pushError(row.rowNumber, 'criteriaSlotUnused');
			}
			if (!scoredAny) pushError(row.rowNumber, 'noCriteriaScored');
		}

		const missingOutcomes = [...questionsByOutcomeCode.keys()].filter(
			(code) => !seenOutcomeCodes.has(code),
		);
		if (missingOutcomes.length > 0) {
			pushError(rows[rows.length - 1].rowNumber, 'outcomeMissing');
		}

		if (errorsByRow.size > 0) return { errorsByRow };

		const criteriaToQuestion = this.buildCriteriaToQuestionMap(resolved.rubric);

		return {
			pending: {
				projectStudentId: resolved.projectStudentId,
				projectEvaluatorId: resolved.projectEvaluatorId,
				studentSectionEnrollmentId: resolved.studentSectionEnrollmentId,
				rubric: resolved.rubric,
				isCapstoneMultiple: true,
				observation,
				qualificationStatusTypeId: resolved.qualificationStatusTypeId,
				scoresToSave,
				criteriaToQuestion,
			},
		};
	}

	/** Valid performance-level values (unique_value) for the Rubric instrument in the given period.
	 * Returns null when no levels are configured (distinct from an empty-but-configured set). */
	private async getValidPerformanceLevelValues(
		rubric: RubricEntity,
		academicPeriodCode: string,
	): Promise<Set<number> | null> {
		const academicPeriod = await this.repository.findAcademicPeriodByCode(academicPeriodCode);
		if (!academicPeriod) return null;

		const instrumentTypeId = await this.repository.findTypeIdByCode(
			TYPE_CODES.PERF_LEVEL_INSTRUMENT.TYPE,
		);
		if (instrumentTypeId === null) return null;

		const levels = await this.repository.findPerformanceLevels(instrumentTypeId, academicPeriod.id);
		if (levels.length === 0) return null;

		return new Set(levels.map((l) => Number(l.uniqueValue)));
	}

	// ── Shared identity resolution ─────────────────────────────────────────

	private async resolveIdentity(input: {
		academicPeriodCode: string;
		projectCode: string;
		studentCode: string;
		evaluatorCode: string;
		statusCode: string;
		gradeTypeCode: string;
		competencyScopeCode: string;
	}): Promise<ResolvedIdentity | { errors: string[] }> {
		const errors: string[] = [];

		const academicPeriod = await this.repository.findAcademicPeriodByCode(input.academicPeriodCode);
		if (!academicPeriod) errors.push('academicPeriodNotFound');

		const project = await this.repository.findProjectByCode(input.projectCode);
		if (!project) errors.push('projectNotFound');

		const statusType = await this.repository.findTypeByCode(input.statusCode);
		if (!statusType) errors.push('statusCodeNotFound');

		const gradeTypeId = await this.repository.findTypeIdByCode(input.gradeTypeCode);
		if (gradeTypeId === null) errors.push('gradeTypeNotFound');

		const competencyScopeTypeId = await this.repository.findTypeIdByCode(input.competencyScopeCode);
		if (competencyScopeTypeId === null) errors.push('competencyScopeNotFound');

		if (
			!academicPeriod ||
			!project ||
			!statusType ||
			gradeTypeId === null ||
			competencyScopeTypeId === null
		) {
			return { errors };
		}

		const professor = await this.repository.findProfessorByCode(input.evaluatorCode);
		if (!professor) errors.push('evaluatorNotFound');

		const projectStudent = project.students.find(
			(ps) => ps.studentSectionEnrollment?.enrolledStudent?.student?.code === input.studentCode,
		);
		if (!projectStudent) errors.push('studentNotInProject');

		const projectEvaluator = professor
			? project.evaluators.find((pe) => pe.professorId === professor.id)
			: undefined;
		if (professor && !projectEvaluator) errors.push('evaluatorNotInProject');
		if (projectEvaluator && !projectEvaluator.isActive) errors.push('evaluatorInactive');
		if (projectEvaluator && !(projectEvaluator.evaluatorType?.extra?.canEvaluate === true)) {
			errors.push('evaluatorTypeNotAuthorized');
		}

		if (!projectStudent || !projectEvaluator) return { errors };

		const courseId = projectStudent.studentSectionEnrollment?.courseSection?.courseId;
		const enrolledStudent = projectStudent.studentSectionEnrollment?.enrolledStudent;
		const studyPlanAcademicPeriodId = enrolledStudent?.studyPlanAcademicPeriodId;
		if (!courseId || !studyPlanAcademicPeriodId) return { errors: [...errors, 'projectNotFound'] };

		// The student's own study plan version must match the period entered in the row — otherwise
		// `findRubric` below could silently resolve a rubric from a different curriculum version that
		// happens to map the same course to the same academic period.
		const studentActualPeriodId = enrolledStudent?.studyPlanAcademicPeriod?.academicPeriodId;
		if (studentActualPeriodId !== undefined && studentActualPeriodId !== academicPeriod.id) {
			return { errors: [...errors, 'academicPeriodMismatch'] };
		}

		const rubric = await this.repository.findRubric(
			studyPlanAcademicPeriodId,
			courseId,
			gradeTypeId,
			competencyScopeTypeId,
		);
		if (!rubric) return { errors: [...errors, 'rubricNotFound'] };
		if (errors.length > 0) return { errors };

		const capstoneTypeId = await this.repository.findTypeIdByCode(TYPE_CODES.RUBRIC_TYPE.CAPSTONE);
		const multipleScopeTypeId = await this.repository.findTypeIdByCode(
			TYPE_CODES.COMPETENCY_SCOPE.MULTIPLE,
		);
		const isCapstone = capstoneTypeId !== null && rubric.rubricTypeId === capstoneTypeId;
		const isMultipleScope =
			multipleScopeTypeId !== null && competencyScopeTypeId === multipleScopeTypeId;

		return {
			rubric,
			isCapstoneMultiple: isCapstone && isMultipleScope,
			projectStudentId: projectStudent.id,
			studentSectionEnrollmentId: projectStudent.studentSectionEnrollmentId,
			projectEvaluatorId: projectEvaluator.id,
			qualificationStatusTypeId: statusType.id,
			isNonAttendanceStatus: statusType.code !== TYPE_CODES.QUALIFICATION_STATUS.ASISTIO,
		};
	}

	private buildObservation(es?: string, en?: string): { es: string; en: string } | undefined {
		const trimmedEs = es?.trim();
		const trimmedEn = en?.trim();
		if (!trimmedEs && !trimmedEn) return undefined;
		return { es: trimmedEs ?? '', en: trimmedEn ?? '' };
	}

	private buildCriteriaToQuestionMap(rubric: RubricEntity): Map<number, number> {
		const map = new Map<number, number>();
		for (const question of rubric.questions ?? []) {
			for (const criteria of question.criterias ?? []) {
				map.set(criteria.id, question.id);
			}
		}
		return map;
	}

	// ── Template generation ────────────────────────────────────────────────

	async generateTemplate(lang: string): Promise<{ buffer: Buffer; fileName: string }> {
		const language = this.resolveLanguage(lang);
		const labels = projectGradesTemplateLabels[language];

		const [gradeTypes, competencyScopeTypes, statusTypes] = await Promise.all([
			this.repository.getGradeTypes(language),
			this.repository.getCompetencyScopeTypes(language),
			this.repository.getQualificationStatusTypes(language),
		]);

		const workbook = new ExcelJS.Workbook();
		// Both data sheets are created first, then both instructions sheets, so worksheet position
		// stays a valid fallback for the name-based sheet lookup used when parsing an upload.
		this.buildSheetB(workbook, labels);
		this.buildSheetA(workbook, labels);
		this.buildInstructionsSheetB(workbook, labels, language, {
			gradeTypes,
			competencyScopeTypes,
			statusTypes,
		});
		this.buildInstructionsSheetA(workbook, labels, language, { gradeTypes, statusTypes });

		const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
		return { buffer, fileName: labels.templateFileName };
	}

	private buildSheetB(workbook: ExcelJS.Workbook, labels: Record<string, string>): void {
		const sheet = workbook.addWorksheet(labels.sheetB);
		const questionHeaders = Array.from(
			{ length: MAX_QUESTION_SLOTS },
			(_, i) => `Q${i + 1} - ${labels.question}`,
		);
		const headers = [
			labels.competencyScopeCode,
			labels.gradeTypeCode,
			labels.academicPeriodCode,
			labels.projectCode,
			labels.studentCode,
			labels.evaluatorCode,
			labels.statusCode,
			...questionHeaders,
			labels.observationEs,
			labels.observationEn,
		];
		sheet.addRow(headers);
		this.styleHeaderRow(sheet, headers);
	}

	private buildInstructionsSheetB(
		workbook: ExcelJS.Workbook,
		labels: Record<string, string>,
		language: string,
		reference: {
			gradeTypes: Array<{ code: string; name: string }>;
			competencyScopeTypes: Array<{ code: string; name: string }>;
			statusTypes: Array<{ code: string; name: string }>;
		},
	): void {
		this.buildInstructionsSheet(
			workbook,
			`${labels.instructionsTitle} — ${labels.sheetB}`,
			labels,
			projectGradesSheetBInstructions[language],
			[
				{
					title: labels.gradeTypesTitle,
					codeLabel: labels.gradeTypesColCode,
					nameLabel: labels.gradeTypesColName,
					rows: reference.gradeTypes,
				},
				{
					title: labels.competencyScopeTitle,
					codeLabel: labels.competencyScopeColCode,
					nameLabel: labels.competencyScopeColName,
					rows: reference.competencyScopeTypes,
				},
				{
					title: labels.statusTypesTitle,
					codeLabel: labels.statusTypesColCode,
					nameLabel: labels.statusTypesColName,
					rows: reference.statusTypes,
				},
			],
		);
	}

	private buildSheetA(workbook: ExcelJS.Workbook, labels: Record<string, string>): void {
		const sheet = workbook.addWorksheet(labels.sheetA);
		const criteriaHeaders = Array.from(
			{ length: MAX_CRITERIA_SLOTS },
			(_, i) => `C${i + 1} - ${labels.criteria}`,
		);
		const headers = [
			labels.gradeTypeCode,
			labels.academicPeriodCode,
			labels.projectCode,
			labels.studentCode,
			labels.evaluatorCode,
			labels.statusCode,
			labels.outcomeCode,
			...criteriaHeaders,
			labels.observationEs,
			labels.observationEn,
		];
		sheet.addRow(headers);
		this.styleHeaderRow(sheet, headers);
	}

	private buildInstructionsSheetA(
		workbook: ExcelJS.Workbook,
		labels: Record<string, string>,
		language: string,
		reference: {
			gradeTypes: Array<{ code: string; name: string }>;
			statusTypes: Array<{ code: string; name: string }>;
		},
	): void {
		this.buildInstructionsSheet(
			workbook,
			`${labels.instructionsTitle} — ${labels.sheetA}`,
			labels,
			projectGradesSheetAInstructions[language],
			[
				{
					title: labels.gradeTypesTitle,
					codeLabel: labels.gradeTypesColCode,
					nameLabel: labels.gradeTypesColName,
					rows: reference.gradeTypes,
				},
				{
					title: labels.statusTypesTitle,
					codeLabel: labels.statusTypesColCode,
					nameLabel: labels.statusTypesColName,
					rows: reference.statusTypes,
				},
			],
		);
	}

	private buildInstructionsSheet(
		workbook: ExcelJS.Workbook,
		title: string,
		labels: Record<string, string>,
		instructions: Array<{ field: string; description: string; required: boolean; example: string }>,
		referenceTables: Array<{
			title: string;
			codeLabel: string;
			nameLabel: string;
			rows: Array<{ code: string; name: string }>;
		}>,
	): void {
		const instrSheet = workbook.addWorksheet(title.slice(0, 31));
		const instHeaders = [
			labels.instructionsColField,
			labels.instructionsColDescription,
			labels.instructionsColRequired,
			labels.instructionsColExample,
		];

		const instHeaderRow = instrSheet.getRow(1);
		instHeaders.forEach((h, i) => {
			const cell = instHeaderRow.getCell(i + 1);
			cell.value = h;
			cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
			cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
			cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
		});
		instHeaderRow.height = 22;

		instructions.forEach((instr, idx) => {
			const r = instrSheet.getRow(2 + idx);
			r.getCell(1).value = instr.field;
			r.getCell(2).value = instr.description;
			r.getCell(3).value = instr.required ? labels.instructionsYes : labels.instructionsNo;
			r.getCell(4).value = instr.example;

			for (let c = 1; c <= 4; c++) {
				const cell = r.getCell(c);
				cell.alignment = { vertical: 'middle', wrapText: true };
				cell.border = {
					bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
					right: { style: 'thin', color: { argb: 'FFBFBFBF' } },
				};
			}
			r.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
			r.height = 40;
		});

		instrSheet.getColumn(1).width = 32;
		instrSheet.getColumn(2).width = 70;
		instrSheet.getColumn(3).width = 13;
		instrSheet.getColumn(4).width = 20;

		let nextRow = 2 + instructions.length + 2;
		for (const table of referenceTables) {
			if (table.rows.length === 0) continue;
			nextRow =
				addReferenceTable(
					instrSheet,
					nextRow,
					table.title,
					{ code: table.codeLabel, name: table.nameLabel },
					table.rows,
				) + 1;
		}
	}

	// ── Parsing ─────────────────────────────────────────────────────────────

	/** Resolves a sheet by its known name (language-specific label) rather than by position, since
	 * every data sheet is immediately followed by its own instructions sheet in the workbook. */
	private resolveSheet(
		workbook: ExcelJS.Workbook,
		name: string,
		fallbackIndex: number,
	): ExcelJS.Worksheet | undefined {
		return workbook.getWorksheet(name) ?? workbook.worksheets[fallbackIndex];
	}

	private parseSheetB(
		workbook: ExcelJS.Workbook,
		labels: Record<string, string>,
	): ProjectGradeRowB[] {
		const worksheet = this.resolveSheet(workbook, labels.sheetB, 0);
		if (!worksheet) return [];
		const rows: ProjectGradeRowB[] = [];

		worksheet.eachRow((row, rowNumber) => {
			if (rowNumber === 1) return;

			const questions: string[] = [];
			for (let i = 0; i < MAX_QUESTION_SLOTS; i++) {
				questions.push(readCell(row, B_QUESTION_START + i));
			}

			const hasAnyValue =
				readCell(row, 1) || readCell(row, 4) || readCell(row, 5) || questions.some((q) => q);
			if (!hasAnyValue) return;

			rows.push({
				rowNumber,
				competencyScopeCode: readCell(row, 1),
				gradeTypeCode: readCell(row, 2),
				academicPeriodCode: readCell(row, 3),
				projectCode: readCell(row, 4),
				studentCode: readCell(row, 5),
				evaluatorCode: readCell(row, 6),
				statusCode: readCell(row, 7),
				questions,
				observationEs: readCell(row, B_OBSERVATION_ES_COLUMN),
				observationEn: readCell(row, B_OBSERVATION_EN_COLUMN),
			});
		});

		return rows;
	}

	private parseSheetA(
		workbook: ExcelJS.Workbook,
		labels: Record<string, string>,
	): ProjectGradeRowA[] {
		const worksheet = this.resolveSheet(workbook, labels.sheetA, 2);
		if (!worksheet) return [];
		const rows: ProjectGradeRowA[] = [];

		worksheet.eachRow((row, rowNumber) => {
			if (rowNumber === 1) return;

			const criterias: string[] = [];
			for (let i = 0; i < MAX_CRITERIA_SLOTS; i++) {
				criterias.push(readCell(row, A_CRITERIA_START + i));
			}

			const hasAnyValue =
				readCell(row, 3) || readCell(row, 4) || readCell(row, 7) || criterias.some((c) => c);
			if (!hasAnyValue) return;

			rows.push({
				rowNumber,
				gradeTypeCode: readCell(row, 1),
				academicPeriodCode: readCell(row, 2),
				projectCode: readCell(row, 3),
				studentCode: readCell(row, 4),
				evaluatorCode: readCell(row, 5),
				statusCode: readCell(row, 6),
				outcomeCode: readCell(row, 7),
				criterias,
				observationEs: readCell(row, A_OBSERVATION_ES_COLUMN),
				observationEn: readCell(row, A_OBSERVATION_EN_COLUMN),
			});
		});

		return rows;
	}

	private styleHeaderRow(sheet: ExcelJS.Worksheet, headers: string[], rowNumber = 1): void {
		const row = sheet.getRow(rowNumber);
		row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
		row.eachCell((cell, colNumber) => {
			cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
			sheet.getColumn(colNumber).width = Math.min(headers[colNumber - 1].length + 4, 30);
		});
	}

	private resolveLanguage(lang?: string): string {
		return lang && projectGradesTemplateLabels[lang] ? lang : DEFAULT_TEMPLATE_LANGUAGE;
	}

	private async annotateErrors(
		workbook: ExcelJS.Workbook,
		labels: Record<string, string>,
		errors: UploadRowError[],
		messages: Record<string, string>,
	): Promise<string> {
		const sheetErrorColumn: Record<'B' | 'A', number> = { B: B_ERROR_COLUMN, A: A_ERROR_COLUMN };
		const worksheets: Record<'B' | 'A', ExcelJS.Worksheet | undefined> = {
			B: this.resolveSheet(workbook, labels.sheetB, 0),
			A: this.resolveSheet(workbook, labels.sheetA, 2),
		};

		for (const sheet of ['B', 'A'] as const) {
			const worksheet = worksheets[sheet];
			if (!worksheet) continue;
			const errorColumn = sheetErrorColumn[sheet];
			const headerCell = worksheet.getRow(1).getCell(errorColumn);
			headerCell.value = labels.errorColumn;
			headerCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
			headerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
			worksheet.getColumn(errorColumn).width = labels.errorColumn.length + 2;
		}

		const byRow = new Map<string, string[]>();
		for (const e of errors) {
			const key = `${e.sheet}:${e.rowNumber}`;
			const list = byRow.get(key) ?? [];
			list.push(...e.errorCodes);
			byRow.set(key, list);
		}
		for (const [key, codes] of byRow) {
			const [sheet, rowNumberStr] = key.split(':') as ['B' | 'A', string];
			const worksheet = worksheets[sheet];
			if (!worksheet) continue;
			const texts = [...new Set(codes)].map((code) => messages[code] ?? code);
			worksheet.getRow(Number(rowNumberStr)).getCell(sheetErrorColumn[sheet]).value =
				texts.join(' | ');
		}

		const buffer = await workbook.xlsx.writeBuffer();
		return Buffer.from(buffer).toString('base64');
	}
}
