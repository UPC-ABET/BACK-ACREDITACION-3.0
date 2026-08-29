import { AcademicSyncService } from './academic-sync.service';
import { AcademicSyncRepository } from '../core/academic-sync.repository';

const mockRepository = {
	getPeriods: jest.fn(),
	getCampuses: jest.fn(),
	getCoursesForPeriod: jest.fn(),
	getSectionsForCourses: jest.fn(),
	getCommissionsByPrograms: jest.fn(),
	getOrgChartNodes: jest.fn(),
	getUsersPage: jest.fn(),
};

describe('AcademicSyncService', () => {
	let service: AcademicSyncService;

	beforeEach(() => {
		jest.clearAllMocks();
		service = new AcademicSyncService(mockRepository as unknown as AcademicSyncRepository);
	});

	describe('getPeriods', () => {
		it('maps academic period rows to the wire shape', async () => {
			mockRepository.getPeriods.mockResolvedValue([
				{
					id: 12,
					code: '2026-1',
					startDate: new Date('2026-03-01'),
					endDate: new Date('2026-07-15'),
					year: 2026,
					modalityTypeId: 1,
				},
			]);

			const result = await service.getPeriods();

			expect(result).toEqual([
				{
					id: 12,
					code: '2026-1',
					startDate: new Date('2026-03-01'),
					endDate: new Date('2026-07-15'),
					year: 2026,
					modalityTypeId: 1,
				},
			]);
		});
	});

	describe('getCampuses', () => {
		it('maps campus rows to the wire shape', async () => {
			mockRepository.getCampuses.mockResolvedValue([
				{ id: 1, code: 'LIM', name: { es: 'Lima', en: 'Lima' } },
			]);

			const result = await service.getCampuses();

			expect(result).toEqual([{ id: 1, code: 'LIM', name: { es: 'Lima', en: 'Lima' } }]);
		});
	});

	describe('getCourses', () => {
		it('returns an empty array when the period has no study plan courses', async () => {
			mockRepository.getCoursesForPeriod.mockResolvedValue([]);

			const result = await service.getCourses(12);

			expect(result).toEqual([]);
			expect(mockRepository.getSectionsForCourses).not.toHaveBeenCalled();
			expect(mockRepository.getCommissionsByPrograms).not.toHaveBeenCalled();
		});

		it('assembles course, sections, and the preferred commission per program', async () => {
			mockRepository.getCoursesForPeriod.mockResolvedValue([
				{
					courseId: 77,
					course: {
						id: 77,
						code: 'CS301',
						name: { es: 'Estructuras de Datos', en: 'Data Structures' },
						description: { es: 'desc', en: 'desc' },
						learningOutcome: { es: 'resultado', en: 'outcome' },
					},
					program: { id: 3, code: 'ISW', name: { es: 'Ing. Software', en: 'Software Eng.' } },
				},
			]);
			mockRepository.getSectionsForCourses.mockResolvedValue([
				{
					id: 501,
					courseId: 77,
					sectionCode: '4321',
					campus: { id: 1, code: 'LIM', name: { es: 'Lima', en: 'Lima' } },
					sectionModalityType: {
						id: 9,
						code: 'TG103-T001',
						name: { es: 'Presencial', en: 'In-person' },
					},
				},
				{ id: 502, courseId: 77, sectionCode: '4322', campus: null, sectionModalityType: null },
			]);
			mockRepository.getCommissionsByPrograms.mockResolvedValue(
				new Map([
					[
						3,
						[
							{ id: 10, code: 'ABC', name: { es: 'ABC', en: 'ABC' } },
							{ id: 11, code: 'EAC', name: { es: 'EAC', en: 'EAC' } },
						],
					],
				]),
			);

			const result = await service.getCourses(12);

			expect(mockRepository.getSectionsForCourses).toHaveBeenCalledWith([77], 12);
			expect(mockRepository.getCommissionsByPrograms).toHaveBeenCalledWith([3], 12);
			expect(result).toEqual([
				{
					id: 77,
					code: 'CS301',
					name: { es: 'Estructuras de Datos', en: 'Data Structures' },
					description: { es: 'desc', en: 'desc' },
					learningOutcome: { es: 'resultado', en: 'outcome' },
					program: { id: 3, code: 'ISW', name: { es: 'Ing. Software', en: 'Software Eng.' } },
					commission: { id: 11, code: 'EAC', name: { es: 'EAC', en: 'EAC' } },
					sections: [
						{
							id: 501,
							sectionCode: '4321',
							campus: { id: 1, code: 'LIM', name: { es: 'Lima', en: 'Lima' } },
							modality: { id: 9, code: 'TG103-T001', name: { es: 'Presencial', en: 'In-person' } },
						},
						{ id: 502, sectionCode: '4322', campus: null, modality: null },
					],
				},
			]);
		});

		it('sets commission to null when the program has no commission rows for the period', async () => {
			mockRepository.getCoursesForPeriod.mockResolvedValue([
				{
					courseId: 88,
					course: {
						id: 88,
						code: 'CS302',
						name: { es: 'a', en: 'a' },
						description: { es: 'a', en: 'a' },
						learningOutcome: { es: 'a', en: 'a' },
					},
					program: { id: 4, code: 'ISI', name: { es: 'b', en: 'b' } },
				},
			]);
			mockRepository.getSectionsForCourses.mockResolvedValue([]);
			mockRepository.getCommissionsByPrograms.mockResolvedValue(new Map());

			const result = await service.getCourses(12);

			expect(result[0].commission).toBeNull();
			expect(result[0].sections).toEqual([]);
		});
	});

	describe('getOrgChart', () => {
		it('maps a chart node with an assigned staff member', async () => {
			mockRepository.getOrgChartNodes.mockResolvedValue([
				{
					id: 100,
					parentId: 5,
					entityType: 'COURSE',
					entityCode: 77,
					staffId: 10,
					staffFirstName: 'Maria',
					staffLastName: 'Lopez',
					staffEmail: 'maria.lopez@upc.edu.pe',
				},
			]);

			const result = await service.getOrgChart(12);

			expect(result).toEqual([
				{
					id: 100,
					parentId: 5,
					entityType: 'COURSE',
					entityCode: 77,
					staff: {
						id: 10,
						firstName: 'Maria',
						lastName: 'Lopez',
						email: 'maria.lopez@upc.edu.pe',
					},
				},
			]);
		});

		it('sets staff to null when the chart node has no staffId', async () => {
			mockRepository.getOrgChartNodes.mockResolvedValue([
				{
					id: 101,
					parentId: null,
					entityType: 'SCHOOL',
					entityCode: 9,
					staffId: null,
					staffFirstName: null,
					staffLastName: null,
					staffEmail: null,
				},
			]);

			const result = await service.getOrgChart(12);

			expect(result[0].staff).toBeNull();
		});
	});

	describe('getUsers', () => {
		it('paginates the user directory', async () => {
			mockRepository.getUsersPage.mockResolvedValue([
				[
					{
						id: 1,
						documentCode: 12345678,
						firstName: 'Maria',
						lastName: 'Lopez',
						email: 'maria.lopez@upc.edu.pe',
						phone: '+51999999999',
					},
				],
				1,
			]);

			const result = await service.getUsers({ page: 1, pageSize: 20 });

			expect(mockRepository.getUsersPage).toHaveBeenCalledWith(0, 20);
			expect(result).toEqual({
				items: [
					{
						id: 1,
						documentCode: 12345678,
						firstName: 'Maria',
						lastName: 'Lopez',
						email: 'maria.lopez@upc.edu.pe',
						phone: '+51999999999',
					},
				],
				total: 1,
				page: 1,
				pageSize: 20,
				totalPages: 1,
			});
		});
	});
});
