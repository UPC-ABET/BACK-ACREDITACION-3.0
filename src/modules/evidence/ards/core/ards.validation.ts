import { BadRequestError, DomainErrorDetail, NotFoundError } from 'src/commons/domain-error';
import { CreateArdDetailsDto, CreateArdDto, UpdateArdDto } from '../model/ards.dtos';
import { ArdRepository } from './ards.repository';
import { ardsValidationStrings } from '../config/strings/ards.validation';

export class ArdValidation {
	static async validateExists(repository: ArdRepository, id: number): Promise<void> {
		const exists = await repository.existsActive(id);
		if (!exists) {
			throw new NotFoundError(ardsValidationStrings.error.notFound);
		}
	}

	static async validateCreate(
		repository: ArdRepository,
		academicPeriodId: number,
		dto: CreateArdDto,
	): Promise<void> {
		const exists = await repository.existsByUniqueTuple(
			academicPeriodId,
			dto.meetingDate,
			dto.campusId,
			dto.programId,
		);
		if (exists) {
			throw new BadRequestError({
				message: ardsValidationStrings.result.createFailed,
				errors: [ardsValidationStrings.error.duplicateArd],
			});
		}
	}

	static async validateUpdate(
		repository: ArdRepository,
		id: number,
		dto: UpdateArdDto,
	): Promise<void> {
		await this.validateExists(repository, id);

		if (dto.meetingDate !== undefined) {
			const duplicate = await repository.existsDuplicateForUpdate(id, dto.meetingDate);
			if (duplicate) {
				throw new BadRequestError({
					message: ardsValidationStrings.result.updateFailed,
					errors: [ardsValidationStrings.error.duplicateArd],
				});
			}
		}
	}

	static async validateDetails(repository: ArdRepository, dto: CreateArdDetailsDto): Promise<void> {
		const exists = await repository.existsActive(dto.ardId);
		if (!exists) {
			throw new NotFoundError(ardsValidationStrings.error.notFound);
		}

		if (!dto.details || dto.details.length === 0) {
			throw new BadRequestError({
				message: ardsValidationStrings.result.detailsFailed,
				errors: [ardsValidationStrings.error.detailsRequired],
			});
		}

		const duplicates = this.findDuplicateDetails(dto.details);
		if (duplicates.length > 0) {
			throw new BadRequestError({
				message: ardsValidationStrings.result.detailsFailed,
				errors: duplicates,
			});
		}
	}

	private static findDuplicateDetails(
		details: CreateArdDetailsDto['details'],
	): DomainErrorDetail[] {
		const seen = new Set<string>();
		const reported = new Set<string>();
		const duplicates: DomainErrorDetail[] = [];

		for (const detail of details) {
			const key = `${detail.enrollmentStudentId}-${detail.courseId}-${detail.professorId}`;
			if (seen.has(key) && !reported.has(key)) {
				reported.add(key);
				duplicates.push({
					code: ardsValidationStrings.error.duplicateDetail,
					enrollmentStudentId: detail.enrollmentStudentId,
					courseId: detail.courseId,
					professorId: detail.professorId,
				});
			}
			seen.add(key);
		}

		return duplicates;
	}
}
