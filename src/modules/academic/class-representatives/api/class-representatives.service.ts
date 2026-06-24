import { Injectable } from '@nestjs/common';
import { PaginatedResult } from 'src/commons/pagination.dtos';
import {
	StudentSectionEnrollmentMaintenanceItem,
	toStudentSectionEnrollmentMaintenanceItem,
} from 'src/modules/academic/student-section-enrollments/model/student-section-enrollments.dtos';
import { StudentSectionEnrollmentRepository } from 'src/modules/academic/student-section-enrollments/core/student-section-enrollments.repository';
import { StudentSectionEnrollmentService } from 'src/modules/academic/student-section-enrollments/api/student-section-enrollments.service';
import { ClassRepresentativesValidation } from '../core/class-representatives.validation';
import { classRepresentativesValidationStrings } from '../config/strings/class-representatives.validation';
import {
	AssignRepresentativeDto,
	ClassRepresentativeMaintenanceQueryDto,
} from '../model/class-representatives.dtos';

@Injectable()
export class ClassRepresentativesService {
	constructor(
		private readonly enrollmentService: StudentSectionEnrollmentService,
		private readonly enrollmentRepository: StudentSectionEnrollmentRepository,
	) {}

	async getAll(): Promise<StudentSectionEnrollmentMaintenanceItem[]> {
		const rows = await this.enrollmentRepository.findByClassRepresentativeFlag(true);
		return rows.map(toStudentSectionEnrollmentMaintenanceItem);
	}

	async assignRepresentative(dto: AssignRepresentativeDto, academicPeriodId: number) {
		const enrollment = await ClassRepresentativesValidation.ensureEnrollmentExists(
			this.enrollmentRepository,
			dto,
			academicPeriodId,
			classRepresentativesValidationStrings.result.assignFailed,
		);
		await this.enrollmentRepository.update(enrollment.id, { isClassRepresentative: true });
		return { success: true };
	}

	async removeRepresentative(dto: AssignRepresentativeDto, academicPeriodId: number) {
		const enrollment = await ClassRepresentativesValidation.ensureEnrollmentExists(
			this.enrollmentRepository,
			dto,
			academicPeriodId,
			classRepresentativesValidationStrings.result.removeFailed,
		);
		await this.enrollmentRepository.update(enrollment.id, { isClassRepresentative: false });
		return { success: true };
	}

	async getMaintenanceList(
		academicPeriodId: number,
		query: ClassRepresentativeMaintenanceQueryDto,
	): Promise<PaginatedResult<StudentSectionEnrollmentMaintenanceItem>> {
		return await this.enrollmentService.getMaintenanceList(academicPeriodId, query, {
			isClassRepresentative: true,
		});
	}
}
