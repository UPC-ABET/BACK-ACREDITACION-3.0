import { BadRequestError } from 'src/commons/domain-error';
import { StudentSectionEnrollmentRepository } from 'src/modules/academic/student-section-enrollments/core/student-section-enrollments.repository';
import { classRepresentativesValidationStrings } from '../config/strings/class-representatives.validation';
import { AssignRepresentativeDto } from '../model/class-representatives.dtos';

export class ClassRepresentativesValidation {
	static async ensureEnrollmentExists(
		repository: StudentSectionEnrollmentRepository,
		dto: AssignRepresentativeDto,
		academicPeriodId: number,
		failureKey: string,
	): Promise<{ id: number }> {
		const enrollment = await repository.findByStudentAndSectionCode(
			dto.studentCode,
			dto.sectionCode,
			academicPeriodId,
		);
		if (!enrollment) {
			throw new BadRequestError({
				message: failureKey,
				errors: [classRepresentativesValidationStrings.error.studentNotEnrolledInSection],
			});
		}
		return enrollment;
	}
}
