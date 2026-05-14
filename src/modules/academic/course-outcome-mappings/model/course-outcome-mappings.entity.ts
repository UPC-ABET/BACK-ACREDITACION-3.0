import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn, IntegerColumn } from 'src/commons/configs/db.configs';
import { OutcomeEntity } from 'src/modules/accreditation/outcomes/model/outcomes.entity';
import { StudyPlanCourseEntity } from 'src/modules/academic/study-plan-courses/model/study-plan-courses.entity';

@Entity({ name: 'course_outcome_mappings', schema: 'academic' })
export class CourseOutcomeMappingEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerFKIDColumn({ nullable: false })
	outcome_id: number;

	@IntegerFKIDColumn({ nullable: false })
	study_plan_course_id: number;

	@IntegerColumn({ nullable: false })
	outcome_type_id: number;

	// %% RELACIONES

	@ManyToOne(() => OutcomeEntity)
	@JoinColumn({ name: 'outcome_id' })
	outcome: OutcomeEntity;

	@ManyToOne(() => StudyPlanCourseEntity)
	@JoinColumn({ name: 'study_plan_course_id' })
	study_plan_course: StudyPlanCourseEntity;
}
