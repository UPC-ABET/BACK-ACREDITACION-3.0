import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn } from 'src/commons/configs/db.configs';
import { AcademicPeriodEntity } from 'src/modules/academic/academic-periods/model/academic-periods.entity';
import { StudyPlanEntity } from 'src/modules/academic/study-plans/model/study-plans.entity';

@Entity({ name: 'study_plan_academic_periods', schema: 'academic' })
export class StudyPlanAcademicPeriodEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	studyPlanId: number;

	@IntegerFKIDColumn({ nullable: false })
	academicPeriodId: number;

	// %% RELATIONS

	@ManyToOne(() => StudyPlanEntity)
	@JoinColumn({
		name: 'study_plan_id',
		foreignKeyConstraintName: 'FK_study_plan_academic_periods_study_plan_id',
	})
	studyPlan: StudyPlanEntity;

	@ManyToOne(() => AcademicPeriodEntity)
	@JoinColumn({
		name: 'academic_period_id',
		foreignKeyConstraintName: 'FK_study_plan_academic_periods_academic_period_id',
	})
	academicPeriod: AcademicPeriodEntity;
}
