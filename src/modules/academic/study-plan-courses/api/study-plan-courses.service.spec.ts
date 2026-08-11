import { StudyPlanCourseService } from './study-plan-courses.service';
import { StudyPlanCourseRepository } from '../core/study-plan-courses.repository';

describe('StudyPlanCourseService.update', () => {
	let service: StudyPlanCourseService;
	let repository: {
		findOneById: jest.Mock;
		findOneByCondition: jest.Mock;
		mergeExtra: jest.Mock;
		update: jest.Mock;
	};

	beforeEach(() => {
		repository = {
			findOneById: jest.fn().mockResolvedValue({ id: 1, extra: { isEvaluable: true } }),
			findOneByCondition: jest.fn().mockResolvedValue(null),
			mergeExtra: jest.fn().mockResolvedValue(undefined),
			update: jest.fn().mockResolvedValue({ id: 1 }),
		};
		service = new StudyPlanCourseService(repository as unknown as StudyPlanCourseRepository);
	});

	it('merges extra instead of writing the column, so sibling keys survive', async () => {
		await service.update(1, { extra: { gradeTypeId: 12 } });

		expect(repository.mergeExtra).toHaveBeenCalledWith(1, { gradeTypeId: 12 }, undefined);
		expect(repository.update).not.toHaveBeenCalled();
	});

	it('writes the remaining columns through the base update', async () => {
		await service.update(1, { extra: { gradeTypeId: 12 }, isElective: true });

		expect(repository.mergeExtra).toHaveBeenCalledWith(1, { gradeTypeId: 12 }, undefined);
		expect(repository.update).toHaveBeenCalledWith(1, { isElective: true }, undefined);
	});

	it('routes the extra merge through the caller transaction, like the column write', async () => {
		const manager = {} as never;

		await service.update(1, { extra: { gradeTypeId: 12 }, isElective: true }, manager);

		expect(repository.mergeExtra).toHaveBeenCalledWith(1, { gradeTypeId: 12 }, manager);
		expect(repository.update).toHaveBeenCalledWith(1, { isElective: true }, manager);
	});

	it('leaves extra untouched when the payload does not mention it', async () => {
		await service.update(1, { levelTypeId: 3 });

		expect(repository.mergeExtra).not.toHaveBeenCalled();
		expect(repository.update).toHaveBeenCalledWith(1, { levelTypeId: 3 }, undefined);
	});
});
