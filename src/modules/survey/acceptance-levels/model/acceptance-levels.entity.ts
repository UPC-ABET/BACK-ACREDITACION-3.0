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
export class AcceptanceLevelEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerFKIDColumn({ nullable: false })
	survey_type_id: number;

	@IntegerFKIDColumn({ nullable: false })
	academic_period_id: number;

	@JsonColumn()
	name: I18nText;

	@IntegerColumn({ nullable: true })
	order: number | null;

	@DecimalColumn({ nullable: false })
	min_score: number;

	@DecimalColumn({ nullable: false })
	max_score: number;

	@TextShortColumn({ nullable: true })
	color: string | null;

	@BooleanColumn()
	is_final: boolean;

	// %% RELACIONES

	@ManyToOne(() => TypeEntity)
	@JoinColumn({ name: 'survey_type_id' })
	survey_type: TypeEntity;

	@ManyToOne(() => AcademicPeriodEntity)
	@JoinColumn({ name: 'academic_period_id' })
	academic_period: AcademicPeriodEntity;
}
