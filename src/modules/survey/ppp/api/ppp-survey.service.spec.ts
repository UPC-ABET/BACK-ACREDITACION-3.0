import * as ExcelJS from 'exceljs';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import type { OutcomeConfigEntity } from 'src/modules/survey/outcome-configs/model/outcome-configs.entity';
import type { JobRegistry } from 'src/modules/survey/shared/core/job-registry';
import {
	buildCompetenceLabels,
	orderConfigsByCompetence,
	PppSurveyService,
} from './ppp-survey.service';
import { pppValidationStrings } from '../config/strings/ppp.validation';
import type { UploadPppExcelDto } from '../model/ppp.dtos';

const { upload } = pppValidationStrings.error;

function config(id: number, commissionTypeCode?: string): OutcomeConfigEntity {
	return {
		id,
		outcomeId: id * 100,
		userOutcomeName: `Outcome ${id}`,
		outcome: commissionTypeCode
			? { programCommission: { commissionType: { code: commissionTypeCode } } }
			: undefined,
	} as unknown as OutcomeConfigEntity;
}

describe('buildCompetenceLabels', () => {
	it('numbers specific configs as CE1..CEn and general ones as CG1..CGn, independently', () => {
		const configs = [
			config(10, TYPE_CODES.COMMISSION_TYPE.SPECIFIC),
			config(11, TYPE_CODES.COMMISSION_TYPE.GENERAL),
			config(12, TYPE_CODES.COMMISSION_TYPE.SPECIFIC),
			config(13, TYPE_CODES.COMMISSION_TYPE.GENERAL),
		];

		const labels = buildCompetenceLabels(configs);

		expect(labels.get(10)).toBe('CE1');
		expect(labels.get(12)).toBe('CE2');
		expect(labels.get(11)).toBe('CG1');
		expect(labels.get(13)).toBe('CG2');
	});

	it('keeps CE/CG grouped even when specific and general configs interleave by order', () => {
		// Same order as they'd come back from a query sorted only by `extra.order`, where
		// specific config #1 and general config #1 can both have order=1 and land adjacent.
		const configs = [
			config(1, TYPE_CODES.COMMISSION_TYPE.GENERAL),
			config(2, TYPE_CODES.COMMISSION_TYPE.SPECIFIC),
			config(3, TYPE_CODES.COMMISSION_TYPE.GENERAL),
			config(4, TYPE_CODES.COMMISSION_TYPE.SPECIFIC),
		];

		const labels = buildCompetenceLabels(configs);

		expect(labels.get(2)).toBe('CE1');
		expect(labels.get(4)).toBe('CE2');
		expect(labels.get(1)).toBe('CG1');
		expect(labels.get(3)).toBe('CG2');
	});

	it('treats a config with no commission type (relation not loaded / missing) as general', () => {
		const configs = [config(1, TYPE_CODES.COMMISSION_TYPE.SPECIFIC), config(2, undefined)];

		const labels = buildCompetenceLabels(configs);

		expect(labels.get(1)).toBe('CE1');
		expect(labels.get(2)).toBe('CG1');
	});

	it('returns an empty map for no configs', () => {
		expect(buildCompetenceLabels([]).size).toBe(0);
	});
});

describe('orderConfigsByCompetence', () => {
	it('puts every specific config before every general one, so the columns match the labels', () => {
		const configs = [
			config(1, TYPE_CODES.COMMISSION_TYPE.GENERAL),
			config(2, TYPE_CODES.COMMISSION_TYPE.SPECIFIC),
			config(3, TYPE_CODES.COMMISSION_TYPE.GENERAL),
			config(4, TYPE_CODES.COMMISSION_TYPE.SPECIFIC),
		];

		expect(orderConfigsByCompetence(configs).map((c) => c.id)).toEqual([2, 4, 1, 3]);
	});

	it('preserves the incoming order within each group', () => {
		const configs = [
			config(9, TYPE_CODES.COMMISSION_TYPE.SPECIFIC),
			config(5, TYPE_CODES.COMMISSION_TYPE.SPECIFIC),
		];

		expect(orderConfigsByCompetence(configs).map((c) => c.id)).toEqual([9, 5]);
	});
});

describe('PppSurveyService bulk upload', () => {
	const USER_ID = 1;
	const PERIOD_ID = 7;
	const TEMPLATE_HEADERS = [
		'Codigo Alumno',
		'# Practica',
		'Horas',
		'Razon Social',
		'Nombre Jefe',
		'Fecha Inicio',
		'Fecha Fin',
		'CE1',
	];

	type Repos = {
		surveyRepo: Record<string, jest.Mock>;
		scoreRepo: Record<string, jest.Mock>;
		configRepo: Record<string, jest.Mock>;
		conversionService: Record<string, jest.Mock>;
	};

	function buildRepos(): Repos {
		let nextSurveyId = 1;
		return {
			surveyRepo: {
				getPppTypeId: jest.fn().mockResolvedValue(1),
				getPppStatusTypeId: jest.fn().mockResolvedValue(2),
				findStudentsByCodes: jest
					.fn()
					.mockImplementation((codes: string[]) =>
						Promise.resolve(codes.map((code, i) => ({ id: 100 + i, code }))),
					),
				findCourseSectionAndCampusByStudents: jest
					.fn()
					.mockImplementation((ids: number[]) =>
						Promise.resolve(ids.map((id) => ({ studentId: id, courseSectionId: 55, campusId: 3 }))),
					),
				findFallbackCourseSection: jest.fn().mockResolvedValue({ courseSectionId: 1, campusId: 1 }),
				findExistingPracticeKeys: jest.fn().mockResolvedValue([]),
				transaction: jest
					.fn()
					.mockImplementation((work: (m: unknown) => Promise<unknown>) => work({} as unknown)),
				create: jest.fn().mockImplementation(() => Promise.resolve({ id: nextSurveyId++ })),
			},
			scoreRepo: { bulkCreate: jest.fn().mockResolvedValue([]) },
			configRepo: {
				findAllPpp: jest.fn().mockResolvedValue([config(10, TYPE_CODES.COMMISSION_TYPE.SPECIFIC)]),
			},
			conversionService: { convertSurveys: jest.fn().mockResolvedValue(undefined) },
		};
	}

	function buildService(repos: Repos = buildRepos()) {
		return new PppSurveyService(
			repos.surveyRepo as never,
			repos.scoreRepo as never,
			repos.configRepo as never,
			repos.conversionService as never,
		);
	}

	async function buildFileBase64(rows: unknown[][]): Promise<string> {
		const workbook = new ExcelJS.Workbook();
		const sheet = workbook.addWorksheet('Plantilla');
		sheet.addRow(TEMPLATE_HEADERS);
		rows.forEach((row) => sheet.addRow(row));
		return Buffer.from(await workbook.xlsx.writeBuffer()).toString('base64');
	}

	function uploadDto(fileBase64: string): UploadPppExcelDto {
		return { programId: 4, campusId: 0, fileBase64 } as UploadPppExcelDto;
	}

	/** The import runs fire-and-forget, so the tests poll the same status endpoint the
	 *  frontend does rather than reaching into the service's internals. */
	async function runUpload(service: PppSurveyService, rows: unknown[][]) {
		const { jobId } = await service.startUploadExcel(
			uploadDto(await buildFileBase64(rows)),
			PERIOD_ID,
			USER_ID,
		);

		for (let i = 0; i < 200; i++) {
			const status = service.getUploadStatus(jobId, USER_ID);
			if (status.done) return { jobId, status };
			await new Promise((resolve) => setImmediate(resolve));
		}
		throw new Error('upload job never finished');
	}

	const validRow = (code: string, practice = 1) => [
		code,
		practice,
		200,
		'ACME',
		'Ana',
		null,
		null,
		4,
	];

	describe('all-or-nothing', () => {
		it('persists nothing when a single row is invalid', async () => {
			const repos = buildRepos();
			const service = buildService(repos);

			const { status } = await runUpload(service, [
				validRow('EST-1'),
				['', 1, 200, 'ACME', 'Ana', null, null, 4],
			]);

			expect(repos.surveyRepo.transaction).not.toHaveBeenCalled();
			expect(repos.surveyRepo.create).not.toHaveBeenCalled();
			expect(repos.scoreRepo.bulkCreate).not.toHaveBeenCalled();
			expect(status.result).toMatchObject({ total: 2, success: 0, failed: 1, hasErrorFile: true });
			expect(status.result?.errors).toEqual([
				{ row: 3, key: upload.studentCodeRequired },
				// The valid row is not reported — it was simply not saved, which the caller
				// reads from `success: 0`.
			]);
		});

		it('reports every row as failed when the commit transaction rolls back', async () => {
			const repos = buildRepos();
			repos.surveyRepo.transaction.mockRejectedValue(new Error('deadlock detected'));
			const service = buildService(repos);

			const { status } = await runUpload(service, [validRow('EST-1'), validRow('EST-2')]);

			expect(status.result).toMatchObject({ total: 2, success: 0, failed: 2, hasErrorFile: true });
			expect(status.result?.errors).toEqual([
				{ row: 2, key: upload.saveFailed, args: { reason: 'deadlock detected' } },
				{ row: 3, key: upload.saveFailed, args: { reason: 'deadlock detected' } },
			]);
		});

		it('inserts every row inside one transaction when they all pass', async () => {
			const repos = buildRepos();
			const service = buildService(repos);

			const { status } = await runUpload(service, [validRow('EST-1'), validRow('EST-2')]);

			expect(repos.surveyRepo.transaction).toHaveBeenCalledTimes(1);
			expect(repos.surveyRepo.create).toHaveBeenCalledTimes(2);
			expect(repos.scoreRepo.bulkCreate).toHaveBeenCalledTimes(2);
			expect(status.result).toMatchObject({ total: 2, success: 2, failed: 0, hasErrorFile: false });
			expect(status.progressPct).toBe(100);
		});

		it('writes the survey inside the caller transaction, not on its own connection', async () => {
			const repos = buildRepos();
			const manager = { marker: 'tx' };
			repos.surveyRepo.transaction.mockImplementation((work: (m: unknown) => Promise<unknown>) =>
				work(manager),
			);
			const service = buildService(repos);

			await runUpload(service, [validRow('EST-1')]);

			expect(repos.surveyRepo.create).toHaveBeenCalledWith(expect.anything(), manager);
			expect(repos.scoreRepo.bulkCreate).toHaveBeenCalledWith(expect.anything(), manager);
		});
	});

	describe('score validation', () => {
		it('rejects a filled competence cell that is out of range instead of dropping it', async () => {
			const repos = buildRepos();
			const service = buildService(repos);

			const { status } = await runUpload(service, [
				['EST-1', 1, 200, 'ACME', 'Ana', null, null, 45],
			]);

			expect(repos.surveyRepo.create).not.toHaveBeenCalled();
			expect(status.result?.errors).toEqual([
				{ row: 2, key: upload.invalidScore, args: { label: 'CE1', value: '45' } },
			]);
		});

		it('rejects a row with no competence score at all', async () => {
			const repos = buildRepos();
			const service = buildService(repos);

			const { status } = await runUpload(service, [
				['EST-1', 1, 200, 'ACME', 'Ana', null, null, null],
			]);

			expect(repos.surveyRepo.create).not.toHaveBeenCalled();
			expect(status.result?.errors).toEqual([{ row: 2, key: upload.noScores }]);
		});
	});

	describe('duplicates', () => {
		it('rejects a practice already registered for that student in the period', async () => {
			const repos = buildRepos();
			repos.surveyRepo.findExistingPracticeKeys.mockResolvedValue([
				{ studentId: 100, practiceNumber: 1 },
			]);
			const service = buildService(repos);

			const { status } = await runUpload(service, [validRow('EST-1', 1)]);

			expect(repos.surveyRepo.create).not.toHaveBeenCalled();
			expect(status.result?.errors).toEqual([
				{ row: 2, key: upload.duplicateSurvey, args: { code: 'EST-1', practiceNumber: 1 } },
			]);
		});

		it('rejects the second appearance of the same student and practice within one file', async () => {
			const repos = buildRepos();
			// Both rows carry the same code, so they resolve to the same student id.
			repos.surveyRepo.findStudentsByCodes.mockResolvedValue([{ id: 100, code: 'EST-1' }]);
			const service = buildService(repos);

			const { status } = await runUpload(service, [validRow('EST-1', 1), validRow('EST-1', 1)]);

			expect(repos.surveyRepo.create).not.toHaveBeenCalled();
			expect(status.result?.errors).toEqual([
				{
					row: 3,
					key: upload.duplicateInFile,
					args: { code: 'EST-1', practiceNumber: 1, firstRow: 2 },
				},
			]);
		});

		it('allows the same student to hold both practice 1 and practice 2', async () => {
			const repos = buildRepos();
			repos.surveyRepo.findStudentsByCodes.mockResolvedValue([{ id: 100, code: 'EST-1' }]);
			const service = buildService(repos);

			const { status } = await runUpload(service, [validRow('EST-1', 1), validRow('EST-1', 2)]);

			expect(status.result).toMatchObject({ success: 2, failed: 0 });
		});
	});

	describe('batched lookups', () => {
		it('resolves students, placements and existing practices once for the whole sheet', async () => {
			const repos = buildRepos();
			const service = buildService(repos);

			await runUpload(
				service,
				Array.from({ length: 25 }, (_unused, i) => validRow(`EST-${i}`)),
			);

			// One query each, not one per row: this is the N+1 the importer used to run.
			expect(repos.surveyRepo.findStudentsByCodes).toHaveBeenCalledTimes(1);
			expect(repos.surveyRepo.findCourseSectionAndCampusByStudents).toHaveBeenCalledTimes(1);
			expect(repos.surveyRepo.findExistingPracticeKeys).toHaveBeenCalledTimes(1);
		});

		it('does not query for a fallback section when every student has a placement', async () => {
			const repos = buildRepos();
			const service = buildService(repos);

			await runUpload(service, [validRow('EST-1')]);

			expect(repos.surveyRepo.findFallbackCourseSection).not.toHaveBeenCalled();
		});

		it('falls back to the first course section for a student with no enrolment', async () => {
			const repos = buildRepos();
			repos.surveyRepo.findCourseSectionAndCampusByStudents.mockResolvedValue([]);
			const service = buildService(repos);

			const { status } = await runUpload(service, [validRow('EST-1')]);

			expect(repos.surveyRepo.findFallbackCourseSection).toHaveBeenCalledTimes(1);
			expect(status.result).toMatchObject({ success: 1, failed: 0 });
		});
	});

	describe('the annotated error file', () => {
		it('is kept out of the status poll and served by its own endpoint', async () => {
			const repos = buildRepos();
			const service = buildService(repos);

			const { jobId, status } = await runUpload(service, [
				['', 1, 200, 'ACME', 'Ana', null, null, 4],
			]);

			// The client polls the status once a second; the workbook must not ride along.
			expect(status).not.toHaveProperty('errorFile');
			const file = service.getUploadErrorFile(jobId, USER_ID);
			expect(file.buffer.length).toBeGreaterThan(0);
			expect(file.fileName).toBe(`errores_ppp_4_${PERIOD_ID}.xlsx`);
		});

		it('is not offered for an upload that succeeded', async () => {
			const service = buildService();

			const { jobId } = await runUpload(service, [validRow('EST-1')]);

			expect(() => service.getUploadErrorFile(jobId, USER_ID)).toThrow(
				pppValidationStrings.error.uploadErrorFileNotFound,
			);
		});

		it('is not served to another user', async () => {
			const service = buildService();

			const { jobId } = await runUpload(service, [['', 1, 200, 'ACME', 'Ana', null, null, 4]]);

			expect(() => service.getUploadErrorFile(jobId, USER_ID + 1)).toThrow(
				pppValidationStrings.error.uploadJobNotFound,
			);
		});
	});

	describe('job capacity', () => {
		function seedRunningJobs(service: PppSurveyService, ownerId: number, count: number) {
			const registry = service['uploadJobs'] as JobRegistry<Record<string, unknown>>;
			for (let i = 0; i < count; i++) {
				registry.register(ownerId, {
					progressPct: 0,
					totalRows: 0,
					processedRows: 0,
					result: null,
					errorFile: null,
				});
			}
		}

		const start = (service: PppSurveyService, userId: number) =>
			service.startUploadExcel(
				{ programId: 1, campusId: 1, fileBase64: '' } as UploadPppExcelDto,
				PERIOD_ID,
				userId,
			);

		it('rejects a user who already holds the per-user cap of running uploads', async () => {
			const service = buildService();
			seedRunningJobs(service, USER_ID, 3);

			await expect(start(service, USER_ID)).rejects.toThrow(
				pppValidationStrings.error.tooManyUploadJobs,
			);
		});

		it('lets a different user through while one user is at their cap', async () => {
			const repos = buildRepos();
			repos.configRepo.findAllPpp.mockResolvedValue([]);
			const service = buildService(repos);
			seedRunningJobs(service, USER_ID, 3);

			// Reaching `noActiveConfig` is how the test tells "the cap let it through" apart
			// from "the cap rejected it".
			await expect(start(service, USER_ID + 1)).rejects.toThrow(
				pppValidationStrings.error.noActiveConfig,
			);
		});

		it('does not leave a running slot held by an upload that failed to start', async () => {
			const repos = buildRepos();
			repos.configRepo.findAllPpp.mockResolvedValue([]);
			const service = buildService(repos);
			const registry = service['uploadJobs'] as JobRegistry<Record<string, unknown>>;

			await expect(start(service, USER_ID)).rejects.toThrow(
				pppValidationStrings.error.noActiveConfig,
			);

			expect(registry.runningCount(USER_ID)).toBe(0);
		});
	});

	describe('status ownership', () => {
		it('hides a job from a user who does not own it', async () => {
			const service = buildService();

			const { jobId } = await runUpload(service, [validRow('EST-1')]);

			expect(() => service.getUploadStatus(jobId, USER_ID + 1)).toThrow(
				pppValidationStrings.error.uploadJobNotFound,
			);
		});
	});
});
