import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { OutcomeEntity } from '../model/outcomes.entity';

export class OutcomeRepository extends BaseRepository<OutcomeEntity> {
	constructor(
		@InjectRepository(OutcomeEntity)
		repository: Repository<OutcomeEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async findByIdWithCommission(id: number): Promise<OutcomeEntity | null> {
		return await this.dataSource
			.createQueryBuilder(OutcomeEntity, 'outcome')
			.leftJoinAndSelect('outcome.program_commission', 'program_commission')
			.leftJoinAndSelect('program_commission.commission', 'commission')
			.where('outcome.id = :id', { id })
			.getOne();
	}
}
