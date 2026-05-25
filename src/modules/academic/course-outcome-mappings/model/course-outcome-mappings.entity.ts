import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn } from 'src/commons/configs/db.configs';
import { OutcomeEntity } from 'src/modules/accreditation/outcomes/model/outcomes.entity';
import { StudyPlanCourseEntity } from 'src/modules/academic/study-plan-courses/model/study-plan-courses.entity';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';

@Entity({ name: 'course_outcome_mappings', schema: 'academic' })
export class CourseOutcomeMappingEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	outcome_id: number;

	@IntegerFKIDColumn({ nullable: false })
	study_plan_course_id: number;

	@IntegerFKIDColumn({ nullable: false })
	outcome_type_id: number;

	// %% RELATIONS

	@ManyToOne(() => OutcomeEntity)
	@JoinColumn({ name: 'outcome_id', foreignKeyConstraintName: 'FK_course_outcome_mappings_outcome_id' })
	outcome: OutcomeEntity;

	@ManyToOne(() => StudyPlanCourseEntity)
	@JoinColumn({ name: 'study_plan_course_id', foreignKeyConstraintName: 'FK_course_outcome_mappings_study_plan_course_id' })
	study_plan_course: StudyPlanCourseEntity;

	@ManyToOne(() => TypeEntity)
	@JoinColumn({ name: 'outcome_type_id', foreignKeyConstraintName: 'FK_course_outcome_mappings_outcome_type_id' })
	outcome_type: TypeEntity;
}
