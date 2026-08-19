import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { EnrolledStudentEntity } from '../model/enrolled-students.entity';
import { StudentEntity } from 'src/modules/academic/students/model/students.entity';
import { StudyPlanAcademicPeriodEntity } from 'src/modules/academic/study-plan-academic-periods/model/study-plan-academic-periods.entity';
import { StudyPlanEntity } from 'src/modules/academic/study-plans/model/study-plans.entity';
import {
	UpdateEnrolledStudentMaintenanceDto,
	CreateEnrolledStudentMaintenanceDto,
} from '../model/enrolled-students.dtos';

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
		programId: number | undefined,
		search: string | undefined,
		skip: number,
		take: number,
	): Promise<[EnrolledStudentEntity[], number]> {
		const qb = this.maintenanceQuery()
			.innerJoin(
				StudyPlanAcademicPeriodEntity,
				'spap',
				'spap.id = enrolled.study_plan_academic_period_id',
			)
			.where('spap.academic_period_id = :academicPeriodId', { academicPeriodId });

		if (programId !== undefined) {
			qb.andWhere('student.program_id = :programId', { programId });
		}

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

	async findStudyPlanAcademicPeriodId(
		programId: number,
		academicPeriodId: number,
	): Promise<number | null> {
		const spap = await this.dataSource
			.createQueryBuilder(StudyPlanAcademicPeriodEntity, 'spap')
			.innerJoin(StudyPlanEntity, 'sp', 'sp.id = spap.study_plan_id')
			.where('sp.program_id = :programId', { programId })
			.andWhere('spap.academic_period_id = :academicPeriodId', { academicPeriodId })
			.orderBy('spap.id', 'ASC')
			.getOne();
		return spap?.id ?? null;
	}

	async findAcademicPeriodId(studyPlanAcademicPeriodId: number): Promise<number | null> {
		const spap = await this.dataSource
			.createQueryBuilder(StudyPlanAcademicPeriodEntity, 'spap')
			.where('spap.id = :id', { id: studyPlanAcademicPeriodId })
			.getOne();
		return spap?.academicPeriodId ?? null;
	}

	// A student may hold at most one ACTIVE enrollment per academic period — enforced at the DB
	// level by academic.fn_enforce_unique_student_academic_period (see migration
	// EnforceUniqueStudentEnrollmentPeriod1787164196191). This mirrors that check for validation,
	// keyed by academic_period_id (via study_plan_academic_periods) rather than by the exact
	// study_plan_academic_period_id — a student re-linked to a different plan for the SAME period
	// must be treated as the same enrollment, not a new one.
	async findActiveEnrollmentInPeriod(
		studentId: number,
		academicPeriodId: number,
		excludeId?: number,
	): Promise<EnrolledStudentEntity | null> {
		const qb = this.dataSource
			.createQueryBuilder(EnrolledStudentEntity, 'enrolled')
			.innerJoin(
				StudyPlanAcademicPeriodEntity,
				'spap',
				'spap.id = enrolled.study_plan_academic_period_id',
			)
			.where('enrolled.student_id = :studentId', { studentId })
			.andWhere('spap.academic_period_id = :academicPeriodId', { academicPeriodId })
			.andWhere('enrolled.is_active = true');

		if (excludeId !== undefined) {
			qb.andWhere('enrolled.id <> :excludeId', { excludeId });
		}

		return await qb.getOne();
	}

	async findStudentIdByCode(code: string): Promise<number | null> {
		const student = await this.dataSource
			.createQueryBuilder(StudentEntity, 's')
			.where('s.code = :code', { code })
			.getOne();
		return student?.id ?? null;
	}

	async createMaintenance(
		dto: CreateEnrolledStudentMaintenanceDto,
		studyPlanAcademicPeriodId: number,
	): Promise<number> {
		return await this.dataSource.transaction(async (manager) => {
			const studentRepo = manager.getRepository(StudentEntity);
			let student = await studentRepo.findOne({ where: { code: dto.studentCode } });
			if (!student) {
				student = await studentRepo.save(
					studentRepo.create({
						code: dto.studentCode,
						firstName: dto.firstName,
						lastName: dto.lastName,
						programId: dto.programId,
						graduationModalityTypeId: dto.enrollementModalityTypeId,
					}),
				);
			}

			const enrolledRepo = manager.getRepository(EnrolledStudentEntity);
			const enrolled = await enrolledRepo.save(
				enrolledRepo.create({
					studentId: student.id,
					studyPlanAcademicPeriodId: studyPlanAcademicPeriodId,
					campusId: dto.campusId,
					enrollementModalityTypeId: dto.enrollementModalityTypeId,
				}),
			);
			return enrolled.id;
		});
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

	// newStudyPlanAcademicPeriodId is the caller-resolved plan link for a program change: when
	// dto.programId moves the student to a different program, the enrollment's own
	// study_plan_academic_period_id must move with it (to that program's plan for the SAME
	// academic period), or the row is left pointing at the old program's plan while the student
	// entity already reports the new program — exactly the mismatch that produced duplicate
	// enrollments before EnforceUniqueStudentEnrollmentPeriod1787164196191.
	async updateMaintenance(
		id: number,
		dto: UpdateEnrolledStudentMaintenanceDto,
		newStudyPlanAcademicPeriodId?: number,
	): Promise<void> {
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
			if (newStudyPlanAcademicPeriodId !== undefined) {
				enrolledChange.studyPlanAcademicPeriodId = newStudyPlanAcademicPeriodId;
			}
			if (Object.keys(enrolledChange).length > 0) {
				await manager.getRepository(EnrolledStudentEntity).update(id, enrolledChange);
			}
		});
	}
}
