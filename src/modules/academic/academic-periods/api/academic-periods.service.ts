import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { AcademicPeriodRepository } from '../core/academic-periods.repository';
import { AcademicPeriodValidation } from '../core/academic-periods.validation';
import { TypeService } from 'src/modules/core/types/api/types.service';
import { TYPE_GROUP_CODES } from 'src/modules/core/types/constants/type-codes';

import {
	CreateAcademicPeriodDto,
	OpenPeriodInput,
	UpdateAcademicPeriodDto,
} from '../model/academic-periods.dtos';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class AcademicPeriodService extends BaseService<AcademicPeriodRepository> {
	constructor(
		protected readonly repository: AcademicPeriodRepository,
		protected readonly dataSource: DataSource,
		private readonly typeService: TypeService,
	) {
		super(repository);
	}

	async create(dto: CreateAcademicPeriodDto, manager?: EntityManager) {
		await AcademicPeriodValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateAcademicPeriodDto, manager?: EntityManager) {
		await AcademicPeriodValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await AcademicPeriodValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}

	async openPeriod(dto: OpenPeriodInput) {
		const modalities = await this.typeService.findByGroupCode(TYPE_GROUP_CODES.PROGRAM_MODALITY);
		const validModalityTypeIds = modalities.map((m: { id: number }) => m.id);

		await AcademicPeriodValidation.validateOpen(this.repository, dto, validModalityTypeIds);

		return await super.create({ ...dto, isActive: false });
	}

	async activatePeriod(id: number) {
		const target = await AcademicPeriodValidation.validateActivate(this.repository, id);

		const currentActive = await this.repository.findOneByCondition({
			where: { modalityTypeId: target.modalityTypeId, isActive: true },
		});

		return await this.dataSource.transaction(async (manager) => {
			if (currentActive && currentActive.id !== id) {
				await this.repository.update(currentActive.id, { isActive: false }, manager);
			}
			return await this.repository.update(id, { isActive: true }, manager);
		});
	}

	async listAllPeriods() {
		return await super.getAll({ order: { code: 'DESC' } as any });
	}
}
