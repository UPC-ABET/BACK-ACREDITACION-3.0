import { BadRequestError, DomainError } from 'src/commons/domain-error';
import { ArdValidation } from './ards.validation';
import { ardsValidationStrings } from '../config/strings/ards.validation';
import { CreateArdDetailsDto, CreateArdDto } from '../model/ards.dtos';

const baseDetail = {
	enrollmentStudentId: 1,
	courseId: 1,
	professorId: 1,
	comments: { es: 'Comentario', en: 'Comment' },
};

const baseDetailsDto: CreateArdDetailsDto = {
	ardId: 1,
	details: [baseDetail],
};

const baseCreateDto: CreateArdDto = {
	meetingDate: '2026-06-23T15:00:00.000Z',
	campusId: 1,
	programId: 1,
};

const mockRepository = {
	existsActive: jest.fn(),
	existsByUniqueTuple: jest.fn(),
	existsDuplicateForUpdate: jest.fn(),
};

describe('ArdValidation', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockRepository.existsActive.mockResolvedValue(true);
		mockRepository.existsByUniqueTuple.mockResolvedValue(false);
		mockRepository.existsDuplicateForUpdate.mockResolvedValue(false);
	});

	describe('validateUpdate', () => {
		it('passes when the new meeting date does not collide', async () => {
			await expect(
				ArdValidation.validateUpdate(mockRepository as never, 1, {
					meetingDate: '2026-07-01T10:00:00.000Z',
				}),
			).resolves.toBeUndefined();
		});

		it('throws when ARD does not exist', async () => {
			mockRepository.existsActive.mockResolvedValue(false);
			await expect(
				ArdValidation.validateUpdate(mockRepository as never, 1, {
					meetingDate: '2026-07-01T10:00:00.000Z',
				}),
			).rejects.toThrow(DomainError);
		});

		it('throws duplicateArd when the new meeting date collides', async () => {
			mockRepository.existsDuplicateForUpdate.mockResolvedValue(true);
			await expect(
				ArdValidation.validateUpdate(mockRepository as never, 1, {
					meetingDate: '2026-07-01T10:00:00.000Z',
				}),
			).rejects.toMatchObject({ errors: [ardsValidationStrings.error.duplicateArd] });
		});

		it('skips the collision check when meetingDate is not provided', async () => {
			await ArdValidation.validateUpdate(mockRepository as never, 1, {});
			expect(mockRepository.existsDuplicateForUpdate).not.toHaveBeenCalled();
		});
	});

	describe('validateExists', () => {
		it('passes when ARD exists', async () => {
			await expect(
				ArdValidation.validateExists(mockRepository as never, 1),
			).resolves.toBeUndefined();
		});

		it('throws when ARD does not exist', async () => {
			mockRepository.existsActive.mockResolvedValue(false);
			await expect(ArdValidation.validateExists(mockRepository as never, 1)).rejects.toThrow(
				DomainError,
			);
		});
	});

	describe('validateCreate', () => {
		it('passes when no ARD with the same period/date/campus/program exists', async () => {
			await expect(
				ArdValidation.validateCreate(mockRepository as never, 1, baseCreateDto),
			).resolves.toBeUndefined();
		});

		it('throws duplicateArd when one already exists', async () => {
			mockRepository.existsByUniqueTuple.mockResolvedValue(true);
			await expect(
				ArdValidation.validateCreate(mockRepository as never, 1, baseCreateDto),
			).rejects.toMatchObject({
				errors: [ardsValidationStrings.error.duplicateArd],
			});
		});
	});

	describe('validateDetails', () => {
		it('passes when ARD exists and details are unique', async () => {
			await expect(
				ArdValidation.validateDetails(mockRepository as never, baseDetailsDto),
			).resolves.toBeUndefined();
		});

		it('throws when ARD does not exist', async () => {
			mockRepository.existsActive.mockResolvedValue(false);
			await expect(
				ArdValidation.validateDetails(mockRepository as never, baseDetailsDto),
			).rejects.toThrow(DomainError);
		});

		it('throws when details list is empty', async () => {
			await expect(
				ArdValidation.validateDetails(mockRepository as never, { ardId: 1, details: [] }),
			).rejects.toThrow(DomainError);
		});

		it('reports the rows that violate the unique constraint', async () => {
			const dto: CreateArdDetailsDto = {
				ardId: 1,
				details: [
					baseDetail,
					{ ...baseDetail },
					{ enrollmentStudentId: 2, courseId: 9, professorId: 3, comments: {} },
				],
			};

			await expect(
				ArdValidation.validateDetails(mockRepository as never, dto),
			).rejects.toMatchObject({
				errors: [
					{
						code: ardsValidationStrings.error.duplicateDetail,
						enrollmentStudentId: 1,
						courseId: 1,
						professorId: 1,
					},
				],
			});
		});

		it('throws a BadRequestError for duplicates', async () => {
			const dto: CreateArdDetailsDto = {
				ardId: 1,
				details: [baseDetail, { ...baseDetail }],
			};
			await expect(
				ArdValidation.validateDetails(mockRepository as never, dto),
			).rejects.toBeInstanceOf(BadRequestError);
		});
	});
});
