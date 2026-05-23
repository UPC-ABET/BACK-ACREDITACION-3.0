import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { PppSurveyRepository } from '../core/ppp-survey.repository';
import { PppScoreRepository } from '../core/ppp-score.repository';
import { PppConfigRepository } from '../core/ppp-config.repository';
import { PppValidation } from '../core/ppp.validation';
import { CreatePppSurveyDto, FilterPppSurveyDto, UploadPppExcelDto, DashboardPppDto, GenerateFindingsPppDto } from '../model/ppp.dtos';

const PPP_TYPE_CODE = 'TG601-T003';
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
		if (!id) throw new BadRequestException(`Tipo de encuesta PPP (${PPP_TYPE_CODE}) no encontrado. Ejecuta el seed de tipos.`);
		return id;
	}

	private async getPppStatusId(): Promise<number> {
		const id = await this.surveyRepo.getPppStatusTypeId(PPP_STATUS_ACTIVE_CODE);
		if (!id) throw new BadRequestException(`Estado de encuesta (${PPP_STATUS_ACTIVE_CODE}) no encontrado. Ejecuta el seed de tipos.`);
		return id;
	}

	async create(dto: CreatePppSurveyDto) {
		PppValidation.validateCreateSurvey(dto);

		const [typeId, statusId] = await Promise.all([this.getPppTypeId(), this.getPppStatusId()]);

		const information = JSON.stringify({
			company_name: dto.company_name ?? null,
			boss_name: dto.boss_name ?? null,
			boss_role: dto.boss_role ?? null,
			phone: dto.phone ?? null,
			email: dto.email ?? null,
			ruc: dto.ruc ?? null,
			total_hours: dto.total_hours ?? null,
			start_date: dto.start_date ?? null,
			end_date: dto.end_date ?? null,
		});

		const survey = await this.surveyRepo.create({
			survey_type_id: typeId,
			survey_status_type_id: statusId,
			student_id: dto.student_id,
			academic_period_id: dto.academic_period_id,
			campus_id: dto.campus_id,
			program_id: dto.program_id,
			survey_number: dto.practice_number,
			information,
			course_section_id: 1, // default; no direct course mapping for PPP
		});

		if (dto.scores?.length) {
			await this.scoreRepo.bulkCreate(
				dto.scores.map((s) => ({
					survey_id: survey.id,
					outcome_id: s.outcome_id,
					score: s.score,
					...(s.commentaries !== undefined && { commentaries: s.commentaries }),
				})),
			);
		}

		return { survey_id: survey.id, scores_created: dto.scores?.length ?? 0 };
	}

	async getAll() {
		const typeId = await this.getPppTypeId();
		return await this.surveyRepo.findAllPpp(typeId);
	}

	async getById(id: number) {
		const typeId = await this.getPppTypeId();
		const survey = await this.surveyRepo.findOnePpp(id, typeId);
		if (!survey) throw new NotFoundException(`Encuesta PPP con ID ${id} no encontrada`);

		const scores = await this.scoreRepo.findBySurveyId(id);
		return { ...survey, scores };
	}

	async getByFilters(dto: FilterPppSurveyDto) {
		const typeId = await this.getPppTypeId();
		return await this.surveyRepo.findAllPpp(typeId, dto);
	}

	async uploadExcel(dto: UploadPppExcelDto) {
		const [typeId, statusId] = await Promise.all([this.getPppTypeId(), this.getPppStatusId()]);

		// Get active PPP configs to know which outcomes to score
		const configs = await this.configRepo.findAllPpp({
			program_id: dto.program_id,
			academic_period_id: dto.academic_period_id,
			is_active: true,
		});

		if (configs.length === 0) {
			throw new BadRequestException('No existen configuraciones PPP activas para el programa y período seleccionados. Crea las competencias primero.');
		}

		// Parse Excel from base64
		let workbook: XLSX.WorkBook;
		try {
			const buffer = Buffer.from(dto.file_base64, 'base64');
			workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
		} catch {
			throw new BadRequestException('El archivo base64 proporcionado no es un Excel válido');
		}

		const sheetName = workbook.SheetNames[0];
		if (!sheetName) throw new BadRequestException('El archivo Excel no contiene hojas');

		const sheet = workbook.Sheets[sheetName];
		const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

		if (rows.length === 0) throw new BadRequestException('El archivo Excel está vacío o no tiene datos en la primera hoja');

		const results = {
			total: rows.length,
			success: 0,
			failed: 0,
			errors: [] as string[],
		};

		for (let i = 0; i < rows.length; i++) {
			const row = rows[i];
			const rowNum = i + 2; // +2 because row 1 is headers

			// Map Excel columns (normalize header names)
			const normalizedRow = {
				student_code: String(row['Codigo Alumno'] ?? row['Código Alumno'] ?? row['CODIGO_ALUMNO'] ?? row['student_code'] ?? '').trim(),
				practice_number: Number(row['# Practica'] ?? row['N Practica'] ?? row['practice_number'] ?? row['Practica'] ?? 0),
				total_hours: Number(row['Horas'] ?? row['Total Horas'] ?? row['TOTAL_HORAS'] ?? row['total_hours'] ?? 0) || null,
				company_name: String(row['Razon Social'] ?? row['Razón Social'] ?? row['company_name'] ?? '').trim() || null,
				ruc: String(row['RUC'] ?? row['ruc'] ?? '').trim() || null,
				boss_name: String(row['Nombre Jefe'] ?? row['boss_name'] ?? '').trim() || null,
				boss_role: String(row['Cargo Jefe'] ?? row['Cargo'] ?? row['boss_role'] ?? '').trim() || null,
				phone: String(row['Telefono'] ?? row['Teléfono'] ?? row['phone'] ?? '').trim() || null,
				email: String(row['Email Jefe'] ?? row['email'] ?? '').trim() || null,
				start_date: row['Fecha Inicio'] ?? row['start_date'] ?? null,
				end_date: row['Fecha Fin'] ?? row['end_date'] ?? null,
			};

			const { valid, errors } = PppValidation.validateExcelRow(normalizedRow, rowNum);
			if (!valid) {
				results.failed++;
				results.errors.push(...errors);
				continue;
			}

			// Look up student by code
			const student = await this.surveyRepo.findStudentByCode(normalizedRow.student_code);
			if (!student) {
				results.failed++;
				results.errors.push(`Fila ${rowNum}: Alumno con código "${normalizedRow.student_code}" no encontrado`);
				continue;
			}

			// Extract scores from Excel columns (one column per outcome config, in order)
			const scores: { outcome_id: number; score: number }[] = [];
			configs.forEach((config, idx) => {
				const colName = `Competencia ${idx + 1}`;
				const altColName = config.user_outcome_name as unknown as string;
				const rawScore = row[colName] ?? row[altColName] ?? null;
				const score = rawScore !== null ? parseFloat(String(rawScore)) : null;

				if (score !== null && !isNaN(score) && score >= 1 && score <= 5) {
					scores.push({ outcome_id: config.outcome_id, score });
				}
			});

			const information = JSON.stringify({
				company_name: normalizedRow.company_name,
				boss_name: normalizedRow.boss_name,
				boss_role: normalizedRow.boss_role,
				phone: normalizedRow.phone,
				email: normalizedRow.email,
				ruc: normalizedRow.ruc,
				total_hours: normalizedRow.total_hours,
				start_date: normalizedRow.start_date,
				end_date: normalizedRow.end_date,
			});

			try {
				const survey = await this.surveyRepo.create({
					survey_type_id: typeId,
					survey_status_type_id: statusId,
					student_id: student.id,
					academic_period_id: dto.academic_period_id,
					campus_id: dto.campus_id,
					program_id: dto.program_id,
					survey_number: Number(normalizedRow.practice_number),
					information,
					course_section_id: 1,
				});

				if (scores.length > 0) {
					await this.scoreRepo.bulkCreate(scores.map((s) => ({ ...s, survey_id: survey.id })));
				}

				results.success++;
			} catch (err) {
				results.failed++;
				results.errors.push(`Fila ${rowNum}: Error al guardar – ${(err as Error).message}`);
			}
		}

		return results;
	}

	async getDashboard(dto: DashboardPppDto) {
		const typeId = await this.getPppTypeId();

		const [surveyCount, dashboardData] = await Promise.all([this.surveyRepo.findAllPpp(typeId, dto).then((r) => r.length), this.surveyRepo.getDashboardData(typeId, dto)]);

		const outcomeResults = dashboardData.map((row) => ({
			outcome_id: row.outcome_id,
			outcome_name: row.outcome_name,
			avg_score: parseFloat(String(row.avg_score)),
			total_surveys: row.total_surveys,
			color: PppValidation.classifyScore(parseFloat(String(row.avg_score))),
		}));

		const summary = {
			total_surveys: surveyCount,
			outcomes_analyzed: outcomeResults.length,
			rojo: outcomeResults.filter((o) => o.color === 'ROJO').length,
			amarillo: outcomeResults.filter((o) => o.color === 'AMARILLO').length,
			verde: outcomeResults.filter((o) => o.color === 'VERDE').length,
		};

		return { summary, outcomes: outcomeResults, filters: dto };
	}

	async generateFindings(dto: GenerateFindingsPppDto) {
		const typeId = await this.getPppTypeId();

		const dashboardData = await this.surveyRepo.getDashboardData(typeId, {
			program_id: dto.program_id,
			academic_period_id: dto.academic_period_id,
			campus_id: dto.campus_id,
			practice_number: dto.practice_number,
		});

		if (dashboardData.length === 0) {
			return { findings: [], message: 'No hay datos de encuestas PPP para el filtro seleccionado' };
		}

		const findings = dashboardData.map((row) => {
			const avgScore = parseFloat(String(row.avg_score));
			const color = PppValidation.classifyScore(avgScore);

			let severity: string;
			let recommendation: string;

			if (color === 'ROJO') {
				severity = 'ALTA';
				recommendation = `La competencia "${row.outcome_name}" tiene un puntaje promedio crítico (${avgScore.toFixed(2)}). Se requiere intervención inmediata y plan de mejora.`;
			} else if (color === 'AMARILLO') {
				severity = 'MEDIA';
				recommendation = `La competencia "${row.outcome_name}" tiene un puntaje promedio en alerta (${avgScore.toFixed(2)}). Se recomienda seguimiento y acciones preventivas.`;
			} else {
				severity = 'BAJA';
				recommendation = `La competencia "${row.outcome_name}" cumple el umbral de aceptación (${avgScore.toFixed(2)}). Mantener el nivel actual.`;
			}

			return {
				outcome_id: row.outcome_id,
				outcome_name: row.outcome_name,
				avg_score: avgScore,
				total_surveys: row.total_surveys,
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
				total_outcomes: findings.length,
				critical: findings.filter((f) => f.color === 'ROJO').length,
				alert: findings.filter((f) => f.color === 'AMARILLO').length,
				acceptable: findings.filter((f) => f.color === 'VERDE').length,
			},
			requires_action: criticalFindings.length > 0,
			message:
				criticalFindings.length > 0
					? `Se detectaron ${criticalFindings.length} competencia(s) que requieren atención (ROJO/AMARILLO)`
					: 'Todas las competencias están dentro del umbral de aceptación',
		};
	}
}
