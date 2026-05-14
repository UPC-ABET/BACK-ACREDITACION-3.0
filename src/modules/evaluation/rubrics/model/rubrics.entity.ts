import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn, IntegerColumn } from 'src/commons/configs/db.configs';
import { StudyPlanCourseEntity } from 'src/modules/academic/study-plan-courses/model/study-plan-courses.entity';

@Entity({ name: 'rubrics', schema: 'evaluation' })
export class RubricEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerColumn({ nullable: false })
	rubric_type_id: number;

	@IntegerColumn({ nullable: false })
	segment_type_id: number;

	@IntegerFKIDColumn({ nullable: false })
	study_plan_course_id: number;

	// %% RELACIONES

	@ManyToOne(() => StudyPlanCourseEntity)
	@JoinColumn({ name: 'study_plan_course_id' })
	study_plan_course: StudyPlanCourseEntity;
}
