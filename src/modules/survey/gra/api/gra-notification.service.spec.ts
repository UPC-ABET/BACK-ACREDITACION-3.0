import * as ExcelJS from 'exceljs';
import { GraNotificationService } from './gra-notification.service';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';

describe('GraNotificationService.exportStudents', () => {
	const surveyRepo = {
		getGraSurveyTypeId: jest.fn().mockResolvedValue(1),
		getActiveSurveyStatusId: jest.fn().mockResolvedValue(2),
		getClosedSurveyStatusId: jest.fn().mockResolvedValue(3),
		getScheduledNotificationStatusId: jest.fn().mockResolvedValue(4),
		getSentNotificationStatusId: jest.fn().mockResolvedValue(5),
	};

	function buildService(rows: unknown[]) {
		const notifRepo = {
			listStudentsGra: jest.fn().mockResolvedValue({ rows, total: rows.length }),
		};
		const service = new GraNotificationService(
			notifRepo as never,
			surveyRepo as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
		);
		return { service, notifRepo };
	}

	async function readSheet(buffer: Buffer) {
		const workbook = new ExcelJS.Workbook();
		await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
		const sheet = workbook.worksheets[0];
		const rows: Record<string, unknown>[] = [];
		sheet.eachRow((row, rowNumber) => {
			if (rowNumber === 1) return;
			rows.push({
				studentCode: row.getCell(1).value,
				studentName: row.getCell(2).value,
				sendStatus: row.getCell(5).value,
				responseStatus: row.getCell(7).value,
			});
		});
		return rows;
	}

	it('labels a sent-and-responded student as Enviado / Respondido', async () => {
		const { service } = buildService([
			{
				studentCode: 'U001',
				studentName: 'Ana Torres',
				studentEmail: 'ana@example.com',
				programName: 'Ingenieria de Software',
				notificationStatusCode: TYPE_CODES.SURVEY_NOTIFICATION_STATUS.SENT,
				sentDate: '2026-01-05T00:00:00.000Z',
				responseStatus: 'RESPONDIDO',
				responseDate: '2026-01-06T00:00:00.000Z',
			},
		]);

		const { buffer } = await service.exportStudents({}, 10);
		const rows = await readSheet(buffer);

		expect(rows).toEqual([
			expect.objectContaining({
				studentCode: 'U001',
				sendStatus: 'Enviado',
				responseStatus: 'Respondido',
			}),
		]);
	});

	it('labels a sent-but-not-responded student as Enviado / Pendiente', async () => {
		const { service } = buildService([
			{
				studentCode: 'U002',
				studentName: 'Luis Gomez',
				studentEmail: 'luis@example.com',
				programName: 'Ingenieria Civil',
				notificationStatusCode: TYPE_CODES.SURVEY_NOTIFICATION_STATUS.SENT,
				sentDate: '2026-01-05T00:00:00.000Z',
				responseStatus: null,
				responseDate: null,
			},
		]);

		const { buffer } = await service.exportStudents({}, 10);
		const rows = await readSheet(buffer);

		expect(rows).toEqual([
			expect.objectContaining({ sendStatus: 'Enviado', responseStatus: 'Pendiente' }),
		]);
	});

	it('labels a not-yet-sent student as Pendiente / "-"', async () => {
		const { service } = buildService([
			{
				studentCode: 'U003',
				studentName: 'Maria Diaz',
				studentEmail: 'maria@example.com',
				programName: 'Ingenieria Civil',
				notificationStatusCode: TYPE_CODES.SURVEY_NOTIFICATION_STATUS.SCHEDULED,
				sentDate: null,
				responseStatus: null,
				responseDate: null,
			},
		]);

		const { buffer } = await service.exportStudents({}, 10);
		const rows = await readSheet(buffer);

		expect(rows).toEqual([
			expect.objectContaining({ sendStatus: 'Pendiente', responseStatus: '-' }),
		]);
	});

	it('forwards the filters and academic period to the repository, ignoring pagination', async () => {
		const { service, notifRepo } = buildService([]);

		await service.exportStudents(
			{ programId: 7, campusId: 2, studentCode: 'U00', search: 'ana' },
			99,
		);

		expect(notifRepo.listStudentsGra).toHaveBeenCalledWith(1, 3, {
			academicPeriodId: 99,
			programId: 7,
			campusId: 2,
			studentCode: 'U00',
			search: 'ana',
		});
	});
});
