import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { ProjectStudentEntity } from '../model/project-students.entity';

export class ProjectStudentRepository extends BaseRepository<ProjectStudentEntity> {
	constructor(
		@InjectRepository(ProjectStudentEntity)
		repository: Repository<ProjectStudentEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
