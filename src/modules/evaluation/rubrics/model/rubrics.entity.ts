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
	rubricTypeId: number;

	@IntegerFKIDColumn({ nullable: false })
	gradeTypeId: number;

	@IntegerFKIDColumn({ nullable: false })
	competencyScopeTypeId: number;

	@IntegerFKIDColumn({ nullable: false })
	studyPlanCourseId: number;

	// %% RELATIONS

	@ManyToOne(() => StudyPlanCourseEntity)
	@JoinColumn({
		name: 'study_plan_course_id',
		foreignKeyConstraintName: 'FK_rubrics_study_plan_course_id',
	})
	studyPlanCourse: StudyPlanCourseEntity;

	@ManyToOne(() => TypeEntity)
	@JoinColumn({ name: 'grade_type_id', foreignKeyConstraintName: 'FK_rubrics_grade_type_id' })
	gradeType: TypeEntity;

	@ManyToOne(() => TypeEntity)
	@JoinColumn({
		name: 'competency_scope_type_id',
		foreignKeyConstraintName: 'FK_rubrics_competency_scope_type_id',
	})
	competencyScopeType: TypeEntity;

	@ManyToOne(() => TypeEntity)
	@JoinColumn({ name: 'rubric_type_id', foreignKeyConstraintName: 'FK_rubrics_rubric_type_id' })
	rubricType: TypeEntity;

	@OneToMany(() => RubricQuestionEntity, (rq) => rq.rubric, { cascade: true, eager: false })
	questions: RubricQuestionEntity[];
}
