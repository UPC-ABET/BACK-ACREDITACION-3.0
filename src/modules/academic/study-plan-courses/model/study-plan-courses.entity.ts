import { Entity, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn, BooleanColumn } from 'src/commons/configs/db.configs';
import { CourseEntity } from 'src/modules/academic/courses/model/courses.entity';
import { StudyPlanAcademicPeriodEntity } from 'src/modules/academic/study-plan-academic-periods/model/study-plan-academic-periods.entity';
import { ProgramEntity } from 'src/modules/academic/programs/model/programs.entity';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';

@Entity({ name: 'study_plan_courses', schema: 'academic' })
@Unique('UQ_study_plan_courses_period_course', ['studyPlanAcademicPeriodId', 'courseId'])
export class StudyPlanCourseEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	studyPlanAcademicPeriodId: number;

	@IntegerFKIDColumn({ nullable: false })
	courseId: number;

	@BooleanColumn({ nullable: false, withDefault: false, default: false })
	isElective: boolean;

	@IntegerFKIDColumn({ nullable: false })
	levelTypeId: number;

	@IntegerFKIDColumn({ nullable: true })
	uploadLogId: number;

	// %% RELATIONS

	@ManyToOne(() => StudyPlanAcademicPeriodEntity)
	@JoinColumn({
		name: 'study_plan_academic_period_id',
		foreignKeyConstraintName: 'FK_study_plan_courses_study_plan_academic_period_id',
	})
	studyPlanAcademicPeriod: StudyPlanAcademicPeriodEntity;

	@ManyToOne(() => CourseEntity)
	@JoinColumn({ name: 'course_id', foreignKeyConstraintName: 'FK_study_plan_courses_course_id' })
	course: CourseEntity;

	@ManyToOne(() => TypeEntity)
	@JoinColumn({
		name: 'level_type_id',
		foreignKeyConstraintName: 'FK_study_plan_courses_level_type_id',
	})
	levelType: TypeEntity;

	// Not a direct FK — reaches the program through study_plan_academic_period -> study_plan.
	// Populated only by `StudyPlanCourseRepository.getByFilters` via `leftJoinAndMapOne`; absent on
	// entities loaded through `BaseRepository` (find/create/update).
	program?: ProgramEntity;
}
