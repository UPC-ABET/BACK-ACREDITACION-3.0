import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { CourseSectionRepository } from '../core/course-sections.repository';
import { CourseSectionValidation } from '../core/course-sections.validation';

import {
	CreateCourseSectionDto,
	UpdateCourseSectionDto,
	CourseSectionMaintenanceQueryDto,
	UpdateCourseSectionMaintenanceDto,
	CreateCourseSectionMaintenanceDto,
	CourseSectionMaintenanceItem,
} from '../model/course-sections.dtos';
import { EntityManager } from 'typeorm';
import { CourseSectionEntity } from '../model/course-sections.entity';
import { PaginatedResult, resolvePagination, toPaginated } from 'src/commons/pagination.dtos';

@Injectable()
export class CourseSectionService extends BaseService<CourseSectionRepository> {
	constructor(protected readonly repository: CourseSectionRepository) {
		super(repository);
	}

	async create(dto: CreateCourseSectionDto, manager?: EntityManager) {
		await CourseSectionValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateCourseSectionDto, manager?: EntityManager) {
		await CourseSectionValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await CourseSectionValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}

	async getMaintenanceList(
		academicPeriodId: number,
		query: CourseSectionMaintenanceQueryDto,
	): Promise<PaginatedResult<CourseSectionMaintenanceItem>> {
		const { page, pageSize, skip, take } = resolvePagination(query);
		const [sections, total] = await this.repository.findMaintenancePage(
			academicPeriodId,
			query.search,
			skip,
			take,
		);

		return toPaginated(
			sections.map((section) => this.toMaintenanceItem(section)),
			total,
			page,
			pageSize,
		);
	}

	async createMaintenance(academicPeriodId: number, dto: CreateCourseSectionMaintenanceDto) {
		await CourseSectionValidation.validateMaintenanceCreate(this.repository, academicPeriodId, dto);
		const created = await this.repository.create({
			courseId: dto.courseId,
			professorId: dto.professorId,
			campusId: dto.campusId,
			sectionModalityTypeId: dto.sectionModalityTypeId,
			sectionCode: dto.sectionCode,
			academicPeriodId,
		});
		return await this.getMaintenanceItem(created.id);
	}

	async updateMaintenance(id: number, dto: UpdateCourseSectionMaintenanceDto) {
		await CourseSectionValidation.validateMaintenanceUpdate(this.repository, id, dto);
		await this.repository.update(id, dto);
		return await this.getMaintenanceItem(id);
	}

	async deleteMaintenance(id: number) {
		await CourseSectionValidation.validateMaintenanceDelete(this.repository, id);
		await this.repository.remove(id);
		return { id };
	}

	private async getMaintenanceItem(id: number): Promise<CourseSectionMaintenanceItem | null> {
		const section = await this.repository.findByIdWithRelations(id);
		return section ? this.toMaintenanceItem(section) : null;
	}

	private toMaintenanceItem(section: CourseSectionEntity): CourseSectionMaintenanceItem {
		return {
			id: section.id,
			courseId: section.courseId,
			courseCode: section.course.code,
			sectionCode: section.sectionCode,
			professorId: section.professorId,
			professorCode: section.professor.code,
			campusId: section.campusId,
			campusCode: section.campus.code,
			sectionModalityTypeId: section.sectionModalityTypeId,
			modalityTypeName: section.sectionModalityType.name,
		};
	}
}
