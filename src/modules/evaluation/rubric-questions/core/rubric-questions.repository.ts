import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { RubricQuestionEntity } from '../model/rubric-questions.entity';

export class RubricQuestionRepository extends BaseRepository<RubricQuestionEntity> {
	constructor(
		@InjectRepository(RubricQuestionEntity)
		repository: Repository<RubricQuestionEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
