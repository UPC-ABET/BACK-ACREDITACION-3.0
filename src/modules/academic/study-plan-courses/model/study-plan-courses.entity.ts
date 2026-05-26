import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn, BooleanColumn } from 'src/commons/configs/db.configs';
import { CourseEntity } from 'src/modules/academic/courses/model/courses.entity';
import { StudyPlanAcademicPeriodEntity } from 'src/modules/academic/study-plan-academic-periods/model/study-plan-academic-periods.entity';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';

@Entity({ name: 'study_plan_courses', schema: 'academic' })
export class StudyPlanCourseEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	study_plan_academic_period_id: number;

	@IntegerFKIDColumn({ nullable: false })
	course_id: number;

	@BooleanColumn({ nullable: false, withDefault: false, default: false })
	is_elective: boolean;

	@IntegerFKIDColumn({ nullable: false })
	level_type_id: number;

	// %% RELATIONS

	@ManyToOne(() => StudyPlanAcademicPeriodEntity)
	@JoinColumn({
		name: 'study_plan_academic_period_id',
		foreignKeyConstraintName: 'FK_study_plan_courses_study_plan_academic_period_id',
	})
	study_plan_academic_period: StudyPlanAcademicPeriodEntity;

	@ManyToOne(() => CourseEntity)
	@JoinColumn({ name: 'course_id', foreignKeyConstraintName: 'FK_study_plan_courses_course_id' })
	course: CourseEntity;

	@ManyToOne(() => TypeEntity)
	@JoinColumn({
		name: 'level_type_id',
		foreignKeyConstraintName: 'FK_study_plan_courses_level_type_id',
	})
	level_type: TypeEntity;
}
