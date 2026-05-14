import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepostitory } from 'src/commons/base.repository';
import { CourseOutcomeMappingEntity } from '../model/course-outcome-mappings.entity';

export class CourseOutcomeMappingRepository extends BaseRepostitory {
	constructor(
		@InjectRepository(CourseOutcomeMappingEntity)
		repository: Repository<CourseOutcomeMappingEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
