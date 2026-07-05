import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindManyOptions, ILike, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { StudentEntity } from '../model/students.entity';
import { StudentSectionEnrollmentEntity } from 'src/modules/academic/student-section-enrollments/model/student-section-enrollments.entity';

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

	/** Active course-section codes per student, for students that currently have any enrollment. */
	async findActiveSectionCodesByStudentIds(
		studentIds: number[],
	): Promise<Array<{ studentId: number; sectionCode: string }>> {
		if (studentIds.length === 0) return [];
		return this.dataSource
			.getRepository(StudentSectionEnrollmentEntity)
			.createQueryBuilder('sse')
			.innerJoin('sse.courseSection', 'cs')
			.innerJoin('sse.enrolledStudent', 'es')
			.where('es.student_id IN (:...studentIds)', { studentIds })
			.andWhere('sse.is_active = true')
			.andWhere('es.is_active = true')
			.select('es.student_id', 'studentId')
			.addSelect('cs.section_code', 'sectionCode')
			.distinct(true)
			.getRawMany();
	}
}
