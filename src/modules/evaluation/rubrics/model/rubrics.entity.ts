import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn } from 'src/commons/configs/db.configs';
import { StudyPlanCourseEntity } from 'src/modules/academic/study-plan-courses/model/study-plan-courses.entity';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';

@Entity({ name: 'rubrics', schema: 'evaluation' })
export class RubricEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerFKIDColumn({ nullable: false })
	rubric_type_id: number;

	@IntegerFKIDColumn({ nullable: false })
	segment_type_id: number;

	@IntegerFKIDColumn({ nullable: false })
	study_plan_course_id: number;

	// %% RELACIONES

	@ManyToOne(() => TypeEntity)
	@JoinColumn({ name: 'rubric_type_id' })
	rubric_type: TypeEntity;

	@ManyToOne(() => TypeEntity)
	@JoinColumn({ name: 'segment_type_id' })
	segment_type: TypeEntity;

	@ManyToOne(() => StudyPlanCourseEntity)
	@JoinColumn({ name: 'study_plan_course_id' })
	study_plan_course: StudyPlanCourseEntity;
}
