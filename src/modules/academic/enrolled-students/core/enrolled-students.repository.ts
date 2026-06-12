import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { EnrolledStudentEntity } from '../model/enrolled-students.entity';
import { StudentEntity } from 'src/modules/academic/students/model/students.entity';
import { StudyPlanAcademicPeriodEntity } from 'src/modules/academic/study-plan-academic-periods/model/study-plan-academic-periods.entity';
import { UpdateEnrolledStudentMaintenanceDto } from '../model/enrolled-students.dtos';

export interface EnrolledStudentDeleteBlockerCounts {
	studentSectionEnrollments: number;
}

export class EnrolledStudentRepository extends BaseRepository<EnrolledStudentEntity> {
	constructor(
		@InjectRepository(EnrolledStudentEntity)
		repository: Repository<EnrolledStudentEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	private maintenanceQuery() {
		return this.dataSource
			.createQueryBuilder(EnrolledStudentEntity, 'enrolled')
			.innerJoinAndSelect('enrolled.student', 'student')
			.innerJoinAndSelect('student.program', 'program')
			.innerJoinAndSelect('enrolled.campus', 'campus')
			.innerJoinAndSelect('enrolled.enrollementModalityType', 'modality');
	}

	async findByIdWithRelations(id: number): Promise<EnrolledStudentEntity | null> {
		return await this.maintenanceQuery().where('enrolled.id = :id', { id }).getOne();
	}

	async findMaintenancePage(
		academicPeriodId: number,
		search: string | undefined,
		skip: number,
		take: number,
	): Promise<[EnrolledStudentEntity[], number]> {
		const qb = this.maintenanceQuery()
			.innerJoin(
				StudyPlanAcademicPeriodEntity,
				'spap',
				'spap.id = enrolled.study_plan_academic_period',
			)
			.where('spap.academic_period_id = :academicPeriodId', { academicPeriodId });

		if (search?.trim()) {
			const term = `%${search.trim()}%`;
			qb.andWhere(
				'(student.code ILIKE :term OR student.firstName ILIKE :term OR student.lastName ILIKE :term)',
				{ term },
			);
		}

		return await qb
			.orderBy('student.lastName', 'ASC')
			.addOrderBy('student.firstName', 'ASC')
			.addOrderBy('enrolled.id', 'ASC')
			.skip(skip)
			.take(take)
			.getManyAndCount();
	}

	async isStudentCodeTaken(code: string, excludeStudentId: number): Promise<boolean> {
		const owner = await this.dataSource
			.createQueryBuilder(StudentEntity, 's')
			.where('s.code = :code', { code })
			.andWhere('s.id <> :excludeStudentId', { excludeStudentId })
			.getOne();
		return owner !== null;
	}

	async findDeleteBlockerCounts(id: number): Promise<EnrolledStudentDeleteBlockerCounts> {
		const [row] = await this.dataSource.query(
			`SELECT (SELECT COUNT(*) FROM academic.student_section_enrollments WHERE enrolled_student_id = $1) AS "studentSectionEnrollments"`,
			[id],
		);
		return { studentSectionEnrollments: Number(row.studentSectionEnrollments) };
	}

	async updateMaintenance(id: number, dto: UpdateEnrolledStudentMaintenanceDto): Promise<void> {
		await this.dataSource.transaction(async (manager) => {
			const enrolled = await manager
				.getRepository(EnrolledStudentEntity)
				.findOne({ where: { id } });
			if (!enrolled) return;

			const studentChange: Partial<StudentEntity> = {};
			if (dto.studentCode !== undefined) studentChange.code = dto.studentCode;
			if (dto.firstName !== undefined) studentChange.firstName = dto.firstName;
			if (dto.lastName !== undefined) studentChange.lastName = dto.lastName;
			if (dto.programId !== undefined) studentChange.programId = dto.programId;
			if (Object.keys(studentChange).length > 0) {
				await manager.getRepository(StudentEntity).update(enrolled.studentId, studentChange);
			}

			const enrolledChange: Partial<EnrolledStudentEntity> = {};
			if (dto.campusId !== undefined) enrolledChange.campusId = dto.campusId;
			if (dto.enrollementModalityTypeId !== undefined) {
				enrolledChange.enrollementModalityTypeId = dto.enrollementModalityTypeId;
			}
			if (Object.keys(enrolledChange).length > 0) {
				await manager.getRepository(EnrolledStudentEntity).update(id, enrolledChange);
			}
		});
	}
}
