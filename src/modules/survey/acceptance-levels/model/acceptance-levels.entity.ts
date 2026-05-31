import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import {
	IntegerFKIDColumn,
	IntegerColumn,
	DecimalColumn,
	TextShortColumn,
	BooleanColumn,
	JsonColumn,
} from 'src/commons/configs/db.configs';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';
import { AcademicPeriodEntity } from 'src/modules/academic/academic-periods/model/academic-periods.entity';
import type { I18nText } from 'src/shared/types/i18n';

@Entity({ name: 'acceptance_levels', schema: 'survey' })
export class PerformanceLevelEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	surveyTypeId: number;

	@IntegerFKIDColumn({ nullable: false })
	academicPeriodId: number;

	@JsonColumn()
	name: I18nText;

	@IntegerColumn({ nullable: true })
	order: number | null;

	@DecimalColumn({ nullable: false })
	minScore: number;

	@DecimalColumn({ nullable: false })
	maxScore: number;

	@TextShortColumn({ nullable: true })
	color: string | null;

	@BooleanColumn()
	isFinal: boolean;

	// %% RELATIONS

	@ManyToOne(() => TypeEntity)
	@JoinColumn({
		name: 'survey_type_id',
		foreignKeyConstraintName: 'FK_acceptance_levels_survey_type_id',
	})
	surveyType: TypeEntity;

	@ManyToOne(() => AcademicPeriodEntity)
	@JoinColumn({
		name: 'academic_period_id',
		foreignKeyConstraintName: 'FK_acceptance_levels_academic_period_id',
	})
	academicPeriod: AcademicPeriodEntity;
}
