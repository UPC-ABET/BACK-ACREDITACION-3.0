import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { ProfessorEntity } from '../model/professors.entity';
import { StaffEntity } from 'src/modules/organization/staff/model/staff.entity';

export class ProfessorRepository extends BaseRepository {
	constructor(
		@InjectRepository(ProfessorEntity)
		repository: Repository<ProfessorEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async getByUserId(user_id: number): Promise<ProfessorEntity | null> {
		return await this.dataSource
			.createQueryBuilder(ProfessorEntity, 'p')
			.innerJoin(StaffEntity, 's', 's.id = p.staff_id')
			.where('s.user_id = :user_id', { user_id })
			.getOne();
	}
}
