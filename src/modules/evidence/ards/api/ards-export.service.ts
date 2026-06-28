import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { NotFoundError } from 'src/commons/domain-error';
import { localize, sanitizeReportFilename } from 'src/libs/reporting/report.utils';
import { ardsValidationStrings } from '../config/strings/ards.validation';
import { ArdRepository } from '../core/ards.repository';
import {
	ArdAttendanceExportDto,
	ArdAttendanceMeta,
	ArdAttendanceStudent,
	ArdExportDto,
	ArdExportMeta,
	ArdExportRow,
} from '../model/ards.dtos';

const THEME = {
	creator: 'ABET system',
	headerBg: 'FFC8102E',
	headerText: 'FFFFFFFF',
	rowBorder: 'FFD4D4D8',
} as const;

const REPORT_COLUMN_WIDTHS = [6, 14, 22, 28, 32, 26, 26, 18, 32, 48];

const REPORT_HEADERS: Record<'es' | 'en', string[]> = {
	es: [
		'N°',
		'Fecha',
		'Código ARD',
		'Docente',
		'Curso',
		'Subárea',
		'Área',
		'Campus',
		'Carrera',
		'Comentarios',
	],
	en: [
		'No.',
		'Date',
		'ARD Code',
		'Professor',
		'Course',
		'Subarea',
		'Area',
		'Campus',
		'Program',
		'Comments',
	],
};

const ATTENDANCE_COLUMN_WIDTHS = [6, 20, 32, 22, 14];

const ATTENDANCE_HEADERS: Record<'es' | 'en', string[]> = {
	es: ['N°', 'Código de estudiante', 'Nombre completo', 'Campus', 'Fecha'],
	en: ['No.', 'Student Code', 'Full Name', 'Campus', 'Date'],
};

@Injectable()
export class ArdExportService {
	constructor(private readonly repository: ArdRepository) {}

	async generateExport(
		academicPeriodId: number,
		dto: ArdExportDto,
	): Promise<{ buffer: Buffer; filename: string }> {
		const meta = await this.repository.getExportMeta(academicPeriodId, dto.programId);
		const rows = await this.repository.findExportRows(academicPeriodId, dto.programId, dto.lang, {
			campusId: dto.campusId,
			areaChartIds: dto.areaChartIds,
			subareaChartIds: dto.subareaChartIds,
		});
		if (rows.length === 0) {
			throw new NotFoundError(ardsValidationStrings.error.noDataToExport);
		}
		const buffer = await this.buildReportWorkbook(rows, dto.lang);
		return { buffer, filename: this.buildReportFilename(meta, dto.lang) };
	}

	async generateAttendanceExport(
		dto: ArdAttendanceExportDto,
	): Promise<{ buffer: Buffer; filename: string }> {
		const meta = await this.repository.findAttendanceMeta(dto.ardId);
		if (!meta) {
			throw new NotFoundError(ardsValidationStrings.error.notFound);
		}
		const students = await this.repository.findAttendanceStudents(dto.ardId);
		const buffer = await this.buildAttendanceWorkbook(meta, students, dto.lang);
		return { buffer, filename: this.buildAttendanceFilename(meta, dto.lang) };
	}

	private buildReportFilename(meta: ArdExportMeta | null, lang: 'es' | 'en'): string {
		const prefix = lang === 'en' ? 'ARD_Report' : 'Reporte_Acta';
		const programName = sanitizeReportFilename(localize(meta?.programName, lang));
		return `${[prefix, meta?.periodCode, programName].filter(Boolean).join('_')}.xlsx`;
	}

	private buildAttendanceFilename(meta: ArdAttendanceMeta, lang: 'es' | 'en'): string {
		const prefix = lang === 'en' ? 'Attendance_Report' : 'Reporte_Asistencia';
		const campusName = sanitizeReportFilename(localize(meta.campusName, lang));
		const programCode = sanitizeReportFilename(meta.programCode);
		return `${[prefix, campusName, programCode, meta.meetingDateFile].filter(Boolean).join('_')}.xlsx`;
	}

	private async buildReportWorkbook(rows: ArdExportRow[], lang: 'es' | 'en'): Promise<Buffer> {
		const wb = new ExcelJS.Workbook();
		wb.creator = THEME.creator;

		const ws = wb.addWorksheet(lang === 'en' ? 'ARD Report' : 'Reporte ARD');
		ws.columns = REPORT_HEADERS[lang].map((header, index) => ({
			header,
			width: REPORT_COLUMN_WIDTHS[index],
		}));

		rows.forEach((row, index) => {
			ws.addRow([
				index + 1,
				row.meetingDate,
				row.code,
				row.professorFullName,
				localize(row.courseName, lang),
				localize(row.subareaName, lang),
				localize(row.areaName, lang),
				localize(row.campusName, lang),
				localize(row.programName, lang),
				localize(row.comments, lang),
			]);
		});

		this.applyStyling(ws);
		return Buffer.from(await wb.xlsx.writeBuffer());
	}

	private async buildAttendanceWorkbook(
		meta: ArdAttendanceMeta,
		students: ArdAttendanceStudent[],
		lang: 'es' | 'en',
	): Promise<Buffer> {
		const wb = new ExcelJS.Workbook();
		wb.creator = THEME.creator;

		const ws = wb.addWorksheet(lang === 'en' ? 'Attendance' : 'Asistencia');
		ws.columns = ATTENDANCE_HEADERS[lang].map((header, index) => ({
			header,
			width: ATTENDANCE_COLUMN_WIDTHS[index],
		}));

		const campusName = localize(meta.campusName, lang);
		students.forEach((student, index) => {
			ws.addRow([
				index + 1,
				student.studentCode,
				student.studentFullName,
				campusName,
				meta.meetingDateLabel,
			]);
		});

		this.applyStyling(ws);
		return Buffer.from(await wb.xlsx.writeBuffer());
	}

	private applyStyling(ws: ExcelJS.Worksheet): void {
		const headerRow = ws.getRow(1);
		headerRow.height = 22;
		headerRow.eachCell((cell) => {
			cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.headerBg } };
			cell.font = { bold: true, color: { argb: THEME.headerText } };
			cell.alignment = { vertical: 'middle', horizontal: 'center' };
			cell.border = {
				top: { style: 'thin' },
				left: { style: 'thin' },
				right: { style: 'thin' },
				bottom: { style: 'thin' },
			};
		});

		ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
			if (rowNumber === 1) return;
			row.eachCell((cell) => {
				cell.border = {
					top: { style: 'thin', color: { argb: THEME.rowBorder } },
					left: { style: 'thin', color: { argb: THEME.rowBorder } },
					right: { style: 'thin', color: { argb: THEME.rowBorder } },
					bottom: { style: 'thin', color: { argb: THEME.rowBorder } },
				};
				cell.alignment = { vertical: 'top', wrapText: true };
			});
		});

		ws.views = [{ state: 'frozen', ySplit: 1 }];
	}
}
