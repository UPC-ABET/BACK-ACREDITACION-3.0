import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepostitory } from 'src/commons/base.repository';
import { ProjectStudentEntity } from '../model/project-students.entity';

export class ProjectStudentRepository extends BaseRepostitory {
	constructor(
		@InjectRepository(ProjectStudentEntity)
		repository: Repository<ProjectStudentEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
