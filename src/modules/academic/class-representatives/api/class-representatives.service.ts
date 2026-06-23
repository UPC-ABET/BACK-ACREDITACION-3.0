import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { BadRequestError } from 'src/commons/domain-error';
import {
	ClassRepresentativeRow,
	ClassRepresentativesRepository,
} from '../core/class-representatives.repository';
import {
	AssignRepresentativeDto,
	ClassRepresentativeMaintenanceQueryDto,
} from '../model/class-representatives.dtos';
import { PaginatedResult, resolvePagination, toPaginated } from 'src/commons/pagination.dtos'; // Reutilizamos el DTO de códigos

@Injectable()
export class ClassRepresentativesService extends BaseService<ClassRepresentativesRepository> {
	constructor(protected readonly repository: ClassRepresentativesRepository) {
		super(repository);
	}

	// 1. LISTAR: Mantiene el SQL crudo personalizado
	async getAll() {
		return await this.repository.findAllRepresentatives();
	}

	// 2. CREAR (Asignar): Cambia el flag a true
	async assignRepresentative(dto: AssignRepresentativeDto) {
		const enrollment = await this.repository.findEnrollmentByCodes(
			dto.studentCode,
			dto.sectionCode,
		);

		if (!enrollment) {
			throw new BadRequestError({
				message: 'error.classRepresentative.enrollmentNotFound',
				errors: ['error.classRepresentativeAssign.studentNotEnrolledInSection.'],
			});
		}

		await this.repository.update(enrollment.id, { isClassRepresentative: true });
		return { success: true };
	}

	// 3. ELIMINAR (Quitar): NUEVO FLUJO — Ahora también valida por códigos y cambia el flag a false
	async removeRepresentative(dto: AssignRepresentativeDto) {
		const enrollment = await this.repository.findEnrollmentByCodes(
			dto.studentCode,
			dto.sectionCode,
		);

		if (!enrollment) {
			throw new BadRequestError({
				message: 'error.classRepresentative.enrollmentNotFound',
				errors: ['The specified student is not enrolled in this course section.'],
			});
		}

		// Modifica la columna 'isClassRepresentative' a false usando el ID encontrado
		await this.repository.update(enrollment.id, { isClassRepresentative: false });
		return { success: true };
	}

	async getMaintenanceList(
		academicPeriodId: number,
		query: ClassRepresentativeMaintenanceQueryDto,
	): Promise<PaginatedResult<ClassRepresentativeRow>> {
		const { page, pageSize, skip, take } = resolvePagination(query);
		const [rows, total] = await this.repository.findMaintenancePage(
			academicPeriodId,
			query.search,
			skip,
			take,
		);
		return toPaginated(rows, total, page, pageSize);
	}
}
