import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepostitory } from 'src/commons/base.repository';
import { CourseSectionEntity } from '../model/course-sections.entity';

export class CourseSectionRepository extends BaseRepostitory {
	constructor(
		@InjectRepository(CourseSectionEntity)
		repository: Repository<CourseSectionEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
