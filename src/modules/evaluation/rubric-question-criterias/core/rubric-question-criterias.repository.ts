import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { RubricQuestionCriteriaEntity } from '../model/rubric-question-criterias.entity';

export class RubricQuestionCriteriaRepository extends BaseRepository {
	constructor(
		@InjectRepository(RubricQuestionCriteriaEntity)
		repository: Repository<RubricQuestionCriteriaEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
