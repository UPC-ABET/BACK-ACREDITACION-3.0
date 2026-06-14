import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { PppSurveyRepository } from '../core/ppp-survey.repository';
import { PppScoreRepository } from '../core/ppp-score.repository';
import { PppConfigRepository } from '../core/ppp-config.repository';
import { PppValidation } from '../core/ppp.validation';
import { i18nText } from 'src/shared/types/i18n';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import {
	CreatePppSurveyDto,
	FilterPppSurveyDto,
	UploadPppExcelDto,
	DashboardPppDto,
	GenerateFindingsPppDto,
} from '../model/ppp.dtos';

const PPP_TYPE_CODE = TYPE_CODES.SURVEY_TYPE.PPP;
const PPP_STATUS_ACTIVE_CODE = 'TG602-T001';

@Injectable()
export class PppSurveyService {
	constructor(
		private readonly surveyRepo: PppSurveyRepository,
		private readonly scoreRepo: PppScoreRepository,
		private readonly configRepo: PppConfigRepository,
	) {}

	private async getPppTypeId(): Promise<number> {
		const id = await this.surveyRepo.getPppTypeId(PPP_TYPE_CODE);
		if (!id)
			throw new BadRequestException(
				`PPP survey type (${PPP_TYPE_CODE}) not found. Run the type seeds.`,
			);
		return id;
	}

	private async getPppStatusId(): Promise<number> {
		const id = await this.surveyRepo.getPppStatusTypeId(PPP_STATUS_ACTIVE_CODE);
		if (!id)
			throw new BadRequestException(
				`Survey status (${PPP_STATUS_ACTIVE_CODE}) not found. Run the type seeds.`,
			);
		return id;
	}

	async create(dto: CreatePppSurveyDto) {
		PppValidation.validateCreateSurvey(dto);

		const [typeId, statusId] = await Promise.all([this.getPppTypeId(), this.getPppStatusId()]);

		const information = JSON.stringify({
			companyName: dto.companyName ?? null,
			bossName: dto.bossName ?? null,
			bossRole: dto.bossRole ?? null,
			phone: dto.phone ?? null,
			email: dto.email ?? null,
			ruc: dto.ruc ?? null,
			totalHours: dto.totalHours ?? null,
			startDate: dto.startDate ?? null,
			endDate: dto.endDate ?? null,
		});

		const survey = await this.surveyRepo.create({
			surveyTypeId: typeId,
			surveyStatusTypeId: statusId,
			studentId: dto.studentId,
			academicPeriodId: dto.academicPeriodId,
			campusId: dto.campusId,
			programId: dto.programId,
			surveyNumber: dto.practiceNumber,
			information: information as any,
			courseSectionId: 1,
		});

		if (dto.scores?.length) {
			await this.scoreRepo.bulkCreate(
				dto.scores.map((s) => ({
					surveyId: survey.id,
					outcomeId: s.outcomeId,
					score: s.score,
					...(s.commentaries !== undefined && { commentaries: i18nText(s.commentaries) }),
				})),
			);
		}

		return { surveyId: survey.id, scoresCreated: dto.scores?.length ?? 0 };
	}

	async getAll() {
		const typeId = await this.getPppTypeId();
		return await this.surveyRepo.findAllPpp(typeId);
	}

	async getById(id: number) {
		const typeId = await this.getPppTypeId();
		const survey = await this.surveyRepo.findOnePpp(id, typeId);
		if (!survey) throw new NotFoundException(`PPP survey with ID ${id} not found`);

		const scores = await this.scoreRepo.findBySurveyId(id);
		return { ...survey, scores };
	}

	async getByFilters(dto: FilterPppSurveyDto) {
		const typeId = await this.getPppTypeId();
		return await this.surveyRepo.findAllPpp(typeId, dto);
	}

	async uploadExcel(dto: UploadPppExcelDto) {
		const [typeId, statusId] = await Promise.all([this.getPppTypeId(), this.getPppStatusId()]);

		const configs = await this.configRepo.findAllPpp({
			programId: dto.programId,
			academicPeriodId: dto.academicPeriodId,
			isActive: true,
		});

		if (configs.length === 0) {
			throw new BadRequestException(
				'No active PPP configurations found for the selected program and period. Create the outcome configurations first.',
			);
		}

		let workbook: XLSX.WorkBook;
		try {
			const buffer = Buffer.from(dto.fileBase64, 'base64');
			workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
		} catch {
			throw new BadRequestException('The provided base64 file is not a valid Excel file');
		}

		const sheetName = workbook.SheetNames[0];
		if (!sheetName) throw new BadRequestException('The Excel file contains no sheets');

		const sheet = workbook.Sheets[sheetName];
		const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

		if (rows.length === 0)
			throw new BadRequestException('The Excel file is empty or has no data on the first sheet');

		const results = {
			total: rows.length,
			success: 0,
			failed: 0,
			errors: [] as string[],
		};

		for (let i = 0; i < rows.length; i++) {
			const row = rows[i];
			const rowNum = i + 2; // +2 because row 1 is headers

			const normalizedRow = {
				studentCode: String(
					row['Codigo Alumno'] ??
						row['Código Alumno'] ??
						row['CODIGO_ALUMNO'] ??
						row['student_code'] ??
						'',
				).trim(),
				practiceNumber: Number(
					row['# Practica'] ?? row['N Practica'] ?? row['practice_number'] ?? row['Practica'] ?? 0,
				),
				totalHours:
					Number(
						row['Horas'] ?? row['Total Horas'] ?? row['TOTAL_HORAS'] ?? row['total_hours'] ?? 0,
					) || null,
				companyName:
					String(row['Razon Social'] ?? row['Razón Social'] ?? row['company_name'] ?? '').trim() ||
					null,
				ruc: String(row['RUC'] ?? row['ruc'] ?? '').trim() || null,
				bossName: String(row['Nombre Jefe'] ?? row['boss_name'] ?? '').trim() || null,
				bossRole:
					String(row['Cargo Jefe'] ?? row['Cargo'] ?? row['boss_role'] ?? '').trim() || null,
				phone: String(row['Telefono'] ?? row['Teléfono'] ?? row['phone'] ?? '').trim() || null,
				email: String(row['Email Jefe'] ?? row['email'] ?? '').trim() || null,
				startDate: row['Fecha Inicio'] ?? row['start_date'] ?? null,
				endDate: row['Fecha Fin'] ?? row['end_date'] ?? null,
			};

			const { valid, errors } = PppValidation.validateExcelRow(normalizedRow, rowNum);
			if (!valid) {
				results.failed++;
				results.errors.push(...errors);
				continue;
			}

			const student = await this.surveyRepo.findStudentByCode(normalizedRow.studentCode);
			if (!student) {
				results.failed++;
				results.errors.push(
					`Row ${rowNum}: Student with code "${normalizedRow.studentCode}" not found`,
				);
				continue;
			}

			// Extract scores from Excel columns (one column per outcome config, in order)
			const scores: { outcomeId: number; score: number }[] = [];
			configs.forEach((config, idx) => {
				const colName = `Competencia ${idx + 1}`;
				const altColName = config.userOutcomeName as unknown as string;
				const rawScore = row[colName] ?? row[altColName] ?? null;
				const score = rawScore !== null ? parseFloat(String(rawScore)) : null;

				if (score !== null && !isNaN(score) && score >= 1 && score <= 5) {
					scores.push({ outcomeId: config.outcomeId, score });
				}
			});

			const information = JSON.stringify({
				companyName: normalizedRow.companyName,
				bossName: normalizedRow.bossName,
				bossRole: normalizedRow.bossRole,
				phone: normalizedRow.phone,
				email: normalizedRow.email,
				ruc: normalizedRow.ruc,
				totalHours: normalizedRow.totalHours,
				startDate: normalizedRow.startDate,
				endDate: normalizedRow.endDate,
			});

			try {
				const survey = await this.surveyRepo.create({
					surveyTypeId: typeId,
					surveyStatusTypeId: statusId,
					studentId: student.id,
					academicPeriodId: dto.academicPeriodId,
					campusId: dto.campusId,
					programId: dto.programId,
					surveyNumber: Number(normalizedRow.practiceNumber),
					information: information as any,
					courseSectionId: 1,
				});

				if (scores.length > 0) {
					await this.scoreRepo.bulkCreate(scores.map((s) => ({ ...s, surveyId: survey.id })));
				}

				results.success++;
			} catch (err) {
				results.failed++;
				results.errors.push(`Row ${rowNum}: Save error – ${(err as Error).message}`);
			}
		}

		return results;
	}

	async getDashboard(dto: DashboardPppDto) {
		const typeId = await this.getPppTypeId();

		const [surveyCount, dashboardData] = await Promise.all([
			this.surveyRepo.findAllPpp(typeId, dto).then((r) => r.length),
			this.surveyRepo.getDashboardData(typeId, dto),
		]);

		const outcomeResults = dashboardData.map((row) => ({
			outcomeId: row.outcomeId,
			outcomeName: row.outcomeName,
			avgScore: parseFloat(String(row.avgScore)),
			totalSurveys: row.totalSurveys,
			color: PppValidation.classifyScore(parseFloat(String(row.avgScore))),
		}));

		const summary = {
			totalSurveys: surveyCount,
			outcomesAnalyzed: outcomeResults.length,
			rojo: outcomeResults.filter((o) => o.color === 'ROJO').length,
			amarillo: outcomeResults.filter((o) => o.color === 'AMARILLO').length,
			verde: outcomeResults.filter((o) => o.color === 'VERDE').length,
		};

		return { summary, outcomes: outcomeResults, filters: dto };
	}

	async generateFindings(dto: GenerateFindingsPppDto) {
		const typeId = await this.getPppTypeId();

		const dashboardData = await this.surveyRepo.getDashboardData(typeId, {
			programId: dto.programId,
			academicPeriodId: dto.academicPeriodId,
			campusId: dto.campusId,
			practiceNumber: dto.practiceNumber,
		});

		if (dashboardData.length === 0) {
			return { findings: [], message: 'No PPP survey data found for the selected filters' };
		}

		const findings = dashboardData.map((row) => {
			const avgScore = parseFloat(String(row.avgScore));
			const color = PppValidation.classifyScore(avgScore);

			let severity: string;
			let recommendation: string;

			if (color === 'ROJO') {
				severity = 'HIGH';
				recommendation = `Outcome "${row.outcomeName}" has a critical average score (${avgScore.toFixed(2)}). Immediate intervention and an improvement plan are required.`;
			} else if (color === 'AMARILLO') {
				severity = 'MEDIUM';
				recommendation = `Outcome "${row.outcomeName}" has an at-risk average score (${avgScore.toFixed(2)}). Follow-up and preventive actions are recommended.`;
			} else {
				severity = 'LOW';
				recommendation = `Outcome "${row.outcomeName}" meets the acceptance threshold (${avgScore.toFixed(2)}). Maintain the current level.`;
			}

			return {
				outcomeId: row.outcomeId,
				outcomeName: row.outcomeName,
				avgScore,
				totalSurveys: row.totalSurveys,
				color,
				severity,
				recommendation,
				thresholds: { rojo: '< 2.5', amarillo: '2.5 – 3.19', verde: '≥ 3.2' },
			};
		});

		const criticalFindings = findings.filter((f) => f.color !== 'VERDE');

		return {
			findings,
			summary: {
				totalOutcomes: findings.length,
				critical: findings.filter((f) => f.color === 'ROJO').length,
				alert: findings.filter((f) => f.color === 'AMARILLO').length,
				acceptable: findings.filter((f) => f.color === 'VERDE').length,
			},
			requiresAction: criticalFindings.length > 0,
			message:
				criticalFindings.length > 0
					? `${criticalFindings.length} outcome(s) require attention (RED/YELLOW)`
					: 'All outcomes are within the acceptance threshold',
		};
	}
}
