import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import { Injectable, Inject, forwardRef } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { RubricConfigService } from 'src/modules/evaluation/rubrics/api/rubric-config.service';
import { GradeExportRow, ProjectRepository } from '../core/projects.repository';
import { ProjectGradeSupportService } from './project-grade-support.service';

@Injectable()
export class ProjectGradeExportService {
	constructor(
		@Inject(forwardRef(() => RubricConfigService))
		private readonly rubricConfigService: RubricConfigService,
		private readonly projectRepository: ProjectRepository,
		private readonly gradeSupport: ProjectGradeSupportService,
	) {}

	async exportProjectGrades(
		academicPeriodId: number,
		schoolId: number,
		competencyScopeCode: string,
	): Promise<Buffer> {
		const competencyScopeTypeId =
			await this.gradeSupport.resolveCompetencyScopeTypeIdByCode(competencyScopeCode);

		const programIds = await this.gradeSupport.resolveProgramIdsBySchoolId(schoolId);
		if (programIds.length === 0) return this.buildGradesExcel([]);

		const rows = await this.projectRepository.getProjectGradesForExport(
			academicPeriodId,
			competencyScopeTypeId,
			programIds,
		);

		const isMultipleScopeExport = competencyScopeCode === TYPE_CODES.COMPETENCY_SCOPE.MULTIPLE;

		// Capstone + Multiple is graded commission-by-commission (EvaluationSubmissionService.
		// submitEvaluation), so the max can't be a rubric-wide constant -- a student who completed
		// only one of several commissions must be scaled against just that commission's criteria.
		// maxPerCriteria is a single per-period value (unique_value ceiling), multiplied per row by
		// that student's own scoreCount -- see ProjectDetailsService.computeStudentGrades for the
		// same rule applied to the project-detail/list endpoints.
		const maxPerCriteria = isMultipleScopeExport
			? await this.gradeSupport.resolvePerformanceLevelUniqueValueMax(academicPeriodId)
			: 0;

		const rubricIds = [...new Set(rows.map((r) => r.rubricId))];
		const maxScoreByRubricId = new Map<number, number>();
		if (!isMultipleScopeExport) {
			await Promise.all(
				rubricIds.map(async (rubricId) => {
					const data = await this.rubricConfigService
						.recalculateMaxScore(rubricId)
						.catch(() => ({ totalMaxScore: 0 }));
					maxScoreByRubricId.set(rubricId, data.totalMaxScore || 0);
				}),
			);
		}

		const graded = rows.map((row) => ({
			...row,
			grade: this.calculateGrade(row, maxPerCriteria, maxScoreByRubricId.get(row.rubricId) ?? 0),
		}));

		return this.buildGradesExcel(graded);
	}

	private calculateGrade(
		row: GradeExportRow,
		maxPerCriteria: number,
		rubricWideMaxScore: number,
	): number {
		const isCapstoneMultiple =
			row.rubricTypeCode === TYPE_CODES.RUBRIC_TYPE.CAPSTONE &&
			row.competencyScopeCode === TYPE_CODES.COMPETENCY_SCOPE.MULTIPLE;

		const sumScores = Number(row.totalScore);

		if (isCapstoneMultiple) {
			const totalMaxScore = maxPerCriteria * Number(row.scoreCount);
			return this.gradeSupport.computeGrade(sumScores, totalMaxScore);
		}

		return sumScores;
	}

	private async buildGradesExcel(rows: (GradeExportRow & { grade: number })[]): Promise<Buffer> {
		const wb = new ExcelJS.Workbook();
		const ws = wb.addWorksheet('Notas');

		const HEADERS = [
			'Código de curso',
			'Código de sección',
			'Código de alumno',
			'Nombre del alumno',
			'Tipo de nota',
			'Nota',
		];

		ws.columns = [
			{ key: 'courseCode', width: 20 },
			{ key: 'sectionCode', width: 20 },
			{ key: 'studentCode', width: 20 },
			{ key: 'studentName', width: 36 },
			{ key: 'gradeTypeCode', width: 14 },
			{ key: 'grade', width: 12 },
		];

		const headerRow = ws.getRow(1);
		HEADERS.forEach((h, i) => {
			const cell = headerRow.getCell(i + 1);
			cell.value = h;
			cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCC0000' } };
			cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
			cell.alignment = { vertical: 'middle', horizontal: 'center' };
			cell.border = {
				top: { style: 'thin' },
				left: { style: 'thin' },
				right: { style: 'thin' },
				bottom: { style: 'thin' },
			};
		});
		headerRow.height = 22;

		for (const row of rows) {
			ws.addRow([
				row.courseCode,
				row.sectionCode,
				row.studentCode,
				row.studentName,
				row.gradeTypeName,
				row.grade,
			]);
		}

		ws.views = [{ state: 'frozen', ySplit: 1 }];

		return Buffer.from(await wb.xlsx.writeBuffer());
	}
}
