import { DomainError } from 'src/commons/domain-error';
import { IfcValidation } from './ifcs.validation';
import { IFC_OPS } from '../api/ifcs.constants';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';

const mockRepo = {
	findOneByCondition: jest.fn(),
	findOneById: jest.fn(),
};

const mockRunner = {
	query: jest.fn(),
};

describe('IfcValidation', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('validateCreate', () => {
		it('passes when no IFC exists for the course', async () => {
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(
				IfcValidation.validateCreate(mockRepo as any, { courseId: 1 }),
			).resolves.toBeUndefined();
		});

		it('throws when an IFC already exists for the course', async () => {
			mockRepo.findOneByCondition.mockResolvedValue({ id: 1 });
			await expect(IfcValidation.validateCreate(mockRepo as any, { courseId: 1 })).rejects.toThrow(
				DomainError,
			);
		});
	});

	describe('validateUpdate', () => {
		it('passes when the entity exists and there is no conflict', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1, courseId: 5 });
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(IfcValidation.validateUpdate(mockRepo as any, 1, {})).resolves.toBeUndefined();
		});

		it('passes when the only match is the entity itself', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1, courseId: 5 });
			mockRepo.findOneByCondition.mockResolvedValue({ id: 1 });
			await expect(IfcValidation.validateUpdate(mockRepo as any, 1, {})).resolves.toBeUndefined();
		});

		it('throws when the entity is not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(IfcValidation.validateUpdate(mockRepo as any, 999, {})).rejects.toThrow(
				DomainError,
			);
		});

		it('throws when the new course collides with another IFC', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1, courseId: 5 });
			mockRepo.findOneByCondition.mockResolvedValue({ id: 2 });
			await expect(
				IfcValidation.validateUpdate(mockRepo as any, 1, { courseId: 9 }),
			).rejects.toThrow(DomainError);
		});
	});

	describe('validateDelete', () => {
		it('passes when the entity exists', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			await expect(IfcValidation.validateDelete(mockRepo as any, 1)).resolves.toBeUndefined();
		});

		it('throws when the entity is not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			await expect(IfcValidation.validateDelete(mockRepo as any, 999)).rejects.toThrow(DomainError);
		});
	});

	describe('assertCurrentStatus', () => {
		it('passes when the current status is allowed', () => {
			expect(() =>
				IfcValidation.assertCurrentStatus(
					TYPE_CODES.IFC_STATUS.SAVED,
					[TYPE_CODES.IFC_STATUS.SAVED],
					IFC_OPS.SUBMIT,
				),
			).not.toThrow();
		});

		it('throws 409 when the current status is not allowed', () => {
			let caught: DomainError | undefined;
			try {
				IfcValidation.assertCurrentStatus('other', [TYPE_CODES.IFC_STATUS.SAVED], IFC_OPS.SUBMIT);
			} catch (e) {
				caught = e as DomainError;
			}
			expect(caught).toBeInstanceOf(DomainError);
			expect(caught!.kind).toBe('conflict');
		});
	});

	describe('assertRequesterIsStaff', () => {
		it('passes when a staff id is present', () => {
			expect(() => IfcValidation.assertRequesterIsStaff(7, IFC_OPS.SUBMIT)).not.toThrow();
		});

		it('throws 403 when no staff id is present', () => {
			let caught: DomainError | undefined;
			try {
				IfcValidation.assertRequesterIsStaff(null, IFC_OPS.SUBMIT);
			} catch (e) {
				caught = e as DomainError;
			}
			expect(caught).toBeInstanceOf(DomainError);
			expect(caught!.kind).toBe('forbidden');
		});
	});

	describe('assertHasHigherLevel', () => {
		const ctx = { ifcId: 1, courseChartId: 10, requesterStaffId: 2, currentStatusCode: null };

		it('passes when a higher level in the chain matches the requester', async () => {
			mockRunner.query.mockResolvedValue([{ '?column?': 1 }]);
			await expect(
				IfcValidation.assertHasHigherLevel(mockRunner as any, ctx, IFC_OPS.APPROVE),
			).resolves.toBeUndefined();
		});

		it('throws 403 when the chart or requester is missing', async () => {
			await expect(
				IfcValidation.assertHasHigherLevel(
					mockRunner as any,
					{ ...ctx, courseChartId: null },
					IFC_OPS.APPROVE,
				),
			).rejects.toThrow(DomainError);
			expect(mockRunner.query).not.toHaveBeenCalled();
		});

		it('throws 403 when no higher level matches', async () => {
			mockRunner.query.mockResolvedValue([]);
			await expect(
				IfcValidation.assertHasHigherLevel(mockRunner as any, ctx, IFC_OPS.APPROVE),
			).rejects.toThrow(DomainError);
		});
	});

	describe('assertCurrentStatusEditable', () => {
		it('passes when the status is SAVED or OBSERVED', () => {
			expect(() =>
				IfcValidation.assertCurrentStatusEditable(TYPE_CODES.IFC_STATUS.SAVED, IFC_OPS.PATCH),
			).not.toThrow();
			expect(() =>
				IfcValidation.assertCurrentStatusEditable(TYPE_CODES.IFC_STATUS.OBSERVED, IFC_OPS.PATCH),
			).not.toThrow();
		});

		it('throws 409 when the status is not editable', () => {
			let caught: DomainError | undefined;
			try {
				IfcValidation.assertCurrentStatusEditable('other', IFC_OPS.PATCH);
			} catch (e) {
				caught = e as DomainError;
			}
			expect(caught).toBeInstanceOf(DomainError);
			expect(caught!.kind).toBe('conflict');
		});
	});

	describe('assertNoIfcExists', () => {
		it('passes when no IFC row exists for the (course, period)', async () => {
			mockRunner.query.mockResolvedValue([]);
			await expect(
				IfcValidation.assertNoIfcExists(mockRunner as any, 1, 2, IFC_OPS.CREATE),
			).resolves.toBeUndefined();
		});

		it('throws 409 when an IFC row already exists', async () => {
			mockRunner.query.mockResolvedValue([{ '?column?': 1 }]);
			await expect(
				IfcValidation.assertNoIfcExists(mockRunner as any, 1, 2, IFC_OPS.CREATE),
			).rejects.toThrow(DomainError);
		});
	});

	describe('assertChartFound', () => {
		it('passes when rows are present', () => {
			expect(() => IfcValidation.assertChartFound([{ id: 1 }], IFC_OPS.CREATE)).not.toThrow();
		});

		it('throws 404 when no rows are found', () => {
			let caught: DomainError | undefined;
			try {
				IfcValidation.assertChartFound([], 'prefill');
			} catch (e) {
				caught = e as DomainError;
			}
			expect(caught).toBeInstanceOf(DomainError);
			expect(caught!.kind).toBe('notFound');
		});
	});

	describe('assertIsInCourseChain', () => {
		const ctx = { ifcId: 1, courseChartId: 10, requesterStaffId: 2, currentStatusCode: null };

		it('passes when the requester is in the course chain', async () => {
			mockRunner.query.mockResolvedValue([{ '?column?': 1 }]);
			await expect(
				IfcValidation.assertIsInCourseChain(mockRunner as any, ctx, IFC_OPS.SUBMIT),
			).resolves.toBeUndefined();
		});

		it('throws 403 when the chart or requester is missing', async () => {
			await expect(
				IfcValidation.assertIsInCourseChain(
					mockRunner as any,
					{ ...ctx, requesterStaffId: null },
					IFC_OPS.SUBMIT,
				),
			).rejects.toThrow(DomainError);
			expect(mockRunner.query).not.toHaveBeenCalled();
		});

		it('throws 403 when the requester is not in the chain', async () => {
			mockRunner.query.mockResolvedValue([]);
			await expect(
				IfcValidation.assertIsInCourseChain(mockRunner as any, ctx, IFC_OPS.SUBMIT),
			).rejects.toThrow(DomainError);
		});
	});

	describe('assertFindingsAndActionsPresent', () => {
		it('passes when every finding has at least one action', () => {
			expect(() =>
				IfcValidation.assertFindingsAndActionsPresent(
					[{ tempId: 'f1' }],
					[{ findingTempId: 'f1' }],
					IFC_OPS.SUBMIT,
				),
			).not.toThrow();
		});

		it('throws when there are no findings', () => {
			expect(() => IfcValidation.assertFindingsAndActionsPresent([], [], IFC_OPS.SUBMIT)).toThrow(
				DomainError,
			);
		});

		it('throws when a finding has no action', () => {
			expect(() =>
				IfcValidation.assertFindingsAndActionsPresent(
					[{ tempId: 'f1' }, { tempId: 'f2' }],
					[{ findingTempId: 'f1' }],
					IFC_OPS.SUBMIT,
				),
			).toThrow(DomainError);
		});
	});

	describe('assertFindingTempIdResolved', () => {
		it('passes when the real id is defined', () => {
			expect(() => IfcValidation.assertFindingTempIdResolved(5, IFC_OPS.CREATE)).not.toThrow();
		});

		it('throws when the real id is undefined', () => {
			expect(() => IfcValidation.assertFindingTempIdResolved(undefined, IFC_OPS.CREATE)).toThrow(
				DomainError,
			);
		});
	});
});
