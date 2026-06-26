import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindManyOptions, ILike, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { StudentEntity } from '../model/students.entity';

export class StudentRepository extends BaseRepository<StudentEntity> {
	constructor(
		@InjectRepository(StudentEntity)
		repository: Repository<StudentEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async findByPartialCode(filters: Record<string, unknown>): Promise<StudentEntity[]> {
		const { code, ...rest } = filters;
		return this.findByCondition({
			where: { ...rest, code: ILike(`%${String(code)}%`) },
		} as FindManyOptions<StudentEntity>);
	}
}
