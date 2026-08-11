import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { StudyPlanCourseEntity } from '../model/study-plan-courses.entity';
import { StudyPlanAcademicPeriodEntity } from '../../study-plan-academic-periods/model/study-plan-academic-periods.entity';
import { StudyPlanEntity } from '../../study-plans/model/study-plans.entity';
import { ScopeFilters } from 'src/commons/scope.dtos';
import {
	programInSchoolSubquery,
	schoolProgramFilterParams,
} from 'src/libs/school-program.functions';
import { CourseEntity } from '../../courses/model/courses.entity';
import { camelToSnake, snakeizeKeys } from 'src/libs/case.functions';
import {
	FilterStudyPlanCourseDto,
	CreateStudyPlanCourseMaintenanceDto,
} from '../model/study-plan-courses.dtos';

export interface StudyPlanCourseDeleteBlockerCounts {
	rubrics: number;
	courseOutcomeMappings: number;
}

export class StudyPlanCourseRepository extends BaseRepository<StudyPlanCourseEntity> {
	constructor(
		@InjectRepository(StudyPlanCourseEntity)
		repository: Repository<StudyPlanCourseEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	// `extra` is a shared bag (is_evaluable, grade_type_id): a caller that names one key must not
	// wipe the ones it never mentioned, so this merges instead of replacing. A key sent as null is
	// a removal. Raw SQL because `repository.update()` would write the whole column.
	//
	// Takes the caller's EntityManager when there is one, the way BaseRepository resolves it: without
	// it this write would sit outside the caller's transaction, so a rolled-back update would leave
	// `extra` committed and the two halves of one update silently disagreeing.
	async mergeExtra(
		id: number,
		extra: Record<string, unknown>,
		manager?: EntityManager,
	): Promise<void> {
		const snakeCased = snakeizeKeys(extra) as Record<string, unknown>;
		const entries = Object.entries(snakeCased);
		const removedKeys = entries.filter(([, value]) => value === null).map(([key]) => key);
		const mergedKeys = Object.fromEntries(entries.filter(([, value]) => value !== null));

		await (manager ?? this.dataSource).query(
			`UPDATE "academic"."study_plan_courses"
			 SET extra = (COALESCE(extra, '{}'::jsonb) || $1::jsonb) - $2::text[],
			     updated_at = now()
			 WHERE id = $3`,
			[JSON.stringify(mergedKeys), removedKeys, id],
		);
	}

	async enableEvaluation(id: number, isEvaluable: boolean): Promise<void> {
		await this.dataSource.query(
			`UPDATE "academic"."study_plan_courses"
			 SET extra = extra || jsonb_build_object('is_evaluable', $1::boolean),
			     updated_at = now()
			 WHERE id = $2`,
			[isEvaluable, id],
		);
	}

	async getByFilters(
		filters: FilterStudyPlanCourseDto & ScopeFilters,
	): Promise<StudyPlanCourseEntity[]> {
		const academicPeriodId = filters.academicPeriodId ?? undefined;
		const schoolId = filters.schoolId ?? undefined;

		const qb = this.dataSource
			.createQueryBuilder(StudyPlanCourseEntity, 'spc')
			.leftJoinAndSelect('spc.course', 'course');

		if (filters.isActive !== undefined)
			qb.andWhere('spc.is_active = :isActive', { isActive: filters.isActive });
		if (filters.courseId !== undefined)
			qb.andWhere('spc.course_id = :courseId', { courseId: filters.courseId });
		if (filters.isElective !== undefined)
			qb.andWhere('spc.is_elective = :isElective', { isElective: filters.isElective });
		if (filters.levelTypeId !== undefined)
			qb.andWhere('spc.level_type_id = :levelTypeId', { levelTypeId: filters.levelTypeId });
		if (filters.studyPlanAcademicPeriodId !== undefined)
			qb.andWhere('spc.study_plan_academic_period_id = :studyPlanAcademicPeriodId', {
				studyPlanAcademicPeriodId: filters.studyPlanAcademicPeriodId,
			});

		if (
			academicPeriodId !== undefined ||
			filters.programId !== undefined ||
			schoolId !== undefined
		) {
			qb.innerJoin(
				StudyPlanAcademicPeriodEntity,
				'spap',
				'spap.id = spc.study_plan_academic_period_id',
			);
			qb.innerJoin(StudyPlanEntity, 'sp', 'sp.id = spap.study_plan_id');

			if (academicPeriodId !== undefined) {
				qb.andWhere('spap.academic_period_id = :academicPeriodId', { academicPeriodId });
			}

			if (filters.programId !== undefined) {
				qb.andWhere('sp.program_id = :programId', { programId: filters.programId });
			}

			if (schoolId !== undefined) {
				qb.andWhere(programInSchoolSubquery('sp.program_id')).setParameters(
					schoolProgramFilterParams(schoolId),
				);
			}
		}

		if (filters.isEvaluable !== undefined) {
			qb.andWhere(`(spc.extra->>'is_evaluable')::boolean = :isEvaluable`, {
				isEvaluable: filters.isEvaluable,
			});
		}

		if (filters.extra && typeof filters.extra === 'object') {
			for (const [key, value] of Object.entries(filters.extra)) {
				if (value === null || value === undefined) continue;
				// Frontend sends camelCase keys; the JSONB content is stored snake_case.
				const snakeKey = camelToSnake(key);
				qb.andWhere(`spc.extra->>'${snakeKey}' = :extra_${snakeKey}`, {
					[`extra_${snakeKey}`]: String(value),
				});
			}
		}

		return await qb.getMany();
	}

	async findStudyPlanAcademicPeriodId(
		studyPlanId: number,
		academicPeriodId: number,
	): Promise<number | null> {
		const spap = await this.dataSource
			.createQueryBuilder(StudyPlanAcademicPeriodEntity, 'spap')
			.where('spap.study_plan_id = :studyPlanId', { studyPlanId })
			.andWhere('spap.academic_period_id = :academicPeriodId', { academicPeriodId })
			.getOne();
		return spap?.id ?? null;
	}

	async findCourseIdByCode(code: string): Promise<number | null> {
		const course = await this.dataSource
			.createQueryBuilder(CourseEntity, 'course')
			.where('course.code = :code', { code })
			.getOne();
		return course?.id ?? null;
	}

	async findByIdWithCourse(id: number): Promise<StudyPlanCourseEntity | null> {
		return await this.dataSource
			.createQueryBuilder(StudyPlanCourseEntity, 'spc')
			.innerJoinAndSelect('spc.course', 'course')
			.where('spc.id = :id', { id })
			.getOne();
	}

	async createMaintenance(
		dto: CreateStudyPlanCourseMaintenanceDto,
		studyPlanAcademicPeriodId: number,
	): Promise<number> {
		return await this.dataSource.transaction(async (manager) => {
			let courseId = dto.courseId ?? null;
			if (!courseId && dto.newCourse) {
				const courseRepo = manager.getRepository(CourseEntity);
				let course = await courseRepo.findOne({ where: { code: dto.newCourse.code } });
				if (!course) {
					course = await courseRepo.save(
						courseRepo.create({
							code: dto.newCourse.code,
							name: dto.newCourse.name,
							learningOutcome: dto.newCourse.learningOutcome ?? {},
						}),
					);
				}
				courseId = course.id;
			}

			const spcRepo = manager.getRepository(StudyPlanCourseEntity);
			const spc = await spcRepo.save(
				spcRepo.create({
					studyPlanAcademicPeriodId,
					courseId: courseId as number,
					isElective: dto.isElective,
					levelTypeId: dto.levelTypeId,
				}),
			);
			return spc.id;
		});
	}

	async findDeleteBlockerCounts(id: number): Promise<StudyPlanCourseDeleteBlockerCounts> {
		const [row] = await this.dataSource.query(
			`SELECT
				(SELECT COUNT(*) FROM evaluation.rubrics WHERE study_plan_course_id = $1) AS "rubrics",
				(SELECT COUNT(*) FROM academic.course_outcome_mappings WHERE study_plan_course_id = $1) AS "courseOutcomeMappings"`,
			[id],
		);

		return {
			rubrics: Number(row.rubrics),
			courseOutcomeMappings: Number(row.courseOutcomeMappings),
		};
	}
}
