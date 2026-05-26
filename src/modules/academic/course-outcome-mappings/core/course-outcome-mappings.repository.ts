import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { CourseOutcomeMappingEntity } from '../model/course-outcome-mappings.entity';

export class CourseOutcomeMappingRepository extends BaseRepository<CourseOutcomeMappingEntity> {
	constructor(
		@InjectRepository(CourseOutcomeMappingEntity)
		repository: Repository<CourseOutcomeMappingEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
