import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn, IntegerColumn, BooleanColumn } from 'src/commons/configs/db.configs';
import { CourseEntity } from 'src/modules/academic/courses/model/courses.entity';
import { StudyPlanAcademicPeriodEntity } from 'src/modules/academic/study-plan-academic-periods/model/study-plan-academic-periods.entity';

@Entity({ name: 'study_plan_courses', schema: 'academic' })
export class StudyPlanCourseEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerFKIDColumn({ nullable: false })
	study_plan_academic_period_id: number;

	@IntegerFKIDColumn({ nullable: false })
	course_id: number;

	@BooleanColumn({ nullable: false, withDefault: false, default: false })
	is_elective: boolean;

	@IntegerColumn({ nullable: false })
	level_type_id: number;

	// %% RELACIONES

	@ManyToOne(() => StudyPlanAcademicPeriodEntity)
	@JoinColumn({ name: 'study_plan_academic_period_id' })
	study_plan_academic_period: StudyPlanAcademicPeriodEntity;

	@ManyToOne(() => CourseEntity)
	@JoinColumn({ name: 'course_id' })
	course: CourseEntity;
}
