import { DomainError } from 'src/commons/domain-error';
import { ArdValidation } from './ards.validation';
import { CreateArdDto, UpdateArdDto } from '../model/ards.dtos';

const baseDetail = {
	enrollmentStudentId: 1,
	courseId: 1,
	professorId: 1,
	comments: 'Student comment',
};

const baseCreateDto: CreateArdDto = {
	meetingDate: '2026-06-23T15:00:00.000Z',
	campusId: 1,
	details: [baseDetail],
};

const mockRepository = {
	existsActive: jest.fn(),
};

describe('ArdValidation', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockRepository.existsActive.mockResolvedValue(true);
	});

	describe('validateCreate', () => {
		it('passes when ARD payload has details', async () => {
			await expect(
				ArdValidation.validateCreate(mockRepository as never, 1, baseCreateDto),
			).resolves.toBeUndefined();
		});

		it('throws when no detail is provided', async () => {
			await expect(
				ArdValidation.validateCreate(mockRepository as never, 1, {
					...baseCreateDto,
					details: [],
				}),
			).rejects.toThrow(DomainError);
		});

		it('throws when details property is missing', async () => {
			await expect(
				ArdValidation.validateCreate(mockRepository as never, 1, {
					meetingDate: baseCreateDto.meetingDate,
					campusId: baseCreateDto.campusId,
				} as CreateArdDto),
			).rejects.toThrow(DomainError);
		});
	});

	describe('validateUpdate', () => {
		it('passes when ARD exists and payload has details', async () => {
			const updateDto: UpdateArdDto = { details: [baseDetail] };
			await expect(
				ArdValidation.validateUpdate(mockRepository as never, 1, 1, updateDto),
			).resolves.toBeUndefined();
		});

		it('throws when ARD does not exist', async () => {
			mockRepository.existsActive.mockResolvedValue(false);
			await expect(
				ArdValidation.validateUpdate(mockRepository as never, 1, 1, { details: [baseDetail] }),
			).rejects.toThrow(DomainError);
		});

		it('throws when update payload has no details', async () => {
			await expect(
				ArdValidation.validateUpdate(mockRepository as never, 1, 1, { details: [] }),
			).rejects.toThrow(DomainError);
		});
	});

	describe('validateDelete', () => {
		it('passes when ARD exists', async () => {
			await expect(
				ArdValidation.validateDelete(mockRepository as never, 1),
			).resolves.toBeUndefined();
		});

		it('throws when ARD does not exist', async () => {
			mockRepository.existsActive.mockResolvedValue(false);
			await expect(ArdValidation.validateDelete(mockRepository as never, 1)).rejects.toThrow(
				DomainError,
			);
		});
	});
});
