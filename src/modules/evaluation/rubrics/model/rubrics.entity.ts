import { Entity, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn, IntegerColumn } from 'src/commons/configs/db.configs';
import { StudyPlanCourseEntity } from 'src/modules/academic/study-plan-courses/model/study-plan-courses.entity';
import { RubricQuestionEntity } from 'src/modules/evaluation/rubric-questions/model/rubric-questions.entity';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';

@Entity({ name: 'rubrics', schema: 'evaluation' })
export class RubricEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerColumn({ nullable: false })
	rubric_type_id: number;

	@IntegerColumn({ nullable: false })
	grade_type_id: number;

	@IntegerFKIDColumn({ nullable: false })
	study_plan_course_id: number;

	// %% RELATIONS

	@ManyToOne(() => StudyPlanCourseEntity)
	@JoinColumn({ name: 'study_plan_course_id', foreignKeyConstraintName: 'FK_rubrics_study_plan_course_id' })
	study_plan_course: StudyPlanCourseEntity;

	@ManyToOne(() => TypeEntity)
	@JoinColumn({ name: 'grade_type_id', foreignKeyConstraintName: 'FK_rubrics_grade_type_id' })
	grade_type: TypeEntity;

	@ManyToOne(() => TypeEntity)
	@JoinColumn({ name: 'rubric_type_id', foreignKeyConstraintName: 'FK_rubrics_rubric_type_id' })
	rubric_type: TypeEntity;

	@OneToMany(() => RubricQuestionEntity, (rq) => rq.rubric, { cascade: true, eager: false })
	questions: RubricQuestionEntity[];
}
