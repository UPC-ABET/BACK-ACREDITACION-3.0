import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { AcademicPeriodEntity } from '../model/academic-periods.entity';

export class AcademicPeriodRepository extends BaseRepository<AcademicPeriodEntity> {
	constructor(
		@InjectRepository(AcademicPeriodEntity)
		repository: Repository<AcademicPeriodEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async activate(id: number, currentActiveId: number | null): Promise<AcademicPeriodEntity | null> {
		return await this.dataSource.transaction(async (manager) => {
			if (currentActiveId !== null && currentActiveId !== id) {
				await this.update(currentActiveId, { isActive: false }, manager);
			}
			return await this.update(id, { isActive: true }, manager);
		});
	}
}
