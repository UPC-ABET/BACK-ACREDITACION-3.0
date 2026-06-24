import { DomainError } from 'src/commons/domain-error';
import { ClassRepresentativesValidation } from './class-representatives.validation';
import { classRepresentativesValidationStrings } from '../config/strings/class-representatives.validation';

const mockRepo = {
	findByStudentAndSectionCode: jest.fn(),
};

const dto = { studentCode: '20231A456', sectionCode: 'SOFT-INT-2026-2-A' };
const academicPeriodId = 1;

describe('ClassRepresentativesValidation', () => {
	beforeEach(() => jest.clearAllMocks());

	describe('ensureEnrollmentExists', () => {
		it('returns the enrollment when one matches the codes', async () => {
			mockRepo.findByStudentAndSectionCode.mockResolvedValue({ id: 7 });
			await expect(
				ClassRepresentativesValidation.ensureEnrollmentExists(
					mockRepo as any,
					dto,
					academicPeriodId,
					classRepresentativesValidationStrings.result.assignFailed,
				),
			).resolves.toEqual({ id: 7 });
		});

		it('throws when no enrollment matches the codes', async () => {
			mockRepo.findByStudentAndSectionCode.mockResolvedValue(null);
			await expect(
				ClassRepresentativesValidation.ensureEnrollmentExists(
					mockRepo as any,
					dto,
					academicPeriodId,
					classRepresentativesValidationStrings.result.removeFailed,
				),
			).rejects.toThrow(DomainError);
		});
	});
});
