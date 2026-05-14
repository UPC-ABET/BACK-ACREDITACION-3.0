import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn } from 'src/commons/configs/db.configs';
import { AcademicPeriodEntity } from 'src/modules/academic/academic-periods/model/academic-periods.entity';
import { StudyPlanEntity } from 'src/modules/academic/study-plans/model/study-plans.entity';

@Entity({ name: 'study_plan_academic_periods', schema: 'academic' })
export class StudyPlanAcademicPeriodEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerFKIDColumn({ nullable: false })
	study_plan_id: number;

	@IntegerFKIDColumn({ nullable: false })
	academic_period_id: number;

	// %% RELACIONES

	@ManyToOne(() => StudyPlanEntity)
	@JoinColumn({ name: 'study_plan_id' })
	study_plan: StudyPlanEntity;

	@ManyToOne(() => AcademicPeriodEntity)
	@JoinColumn({ name: 'academic_period_id' })
	academic_period: AcademicPeriodEntity;
}
