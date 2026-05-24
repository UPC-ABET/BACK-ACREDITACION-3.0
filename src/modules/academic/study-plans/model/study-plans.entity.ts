import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { CodeColumn, IntegerFKIDColumn, JsonColumn } from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';
import { ProgramEntity } from 'src/modules/academic/programs/model/programs.entity';

@Entity({ name: 'study_plans', schema: 'academic' })
export class StudyPlanEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	program_id: number;

	@CodeColumn({ nullable: false, length: 10 })
	code: string;

	@JsonColumn({ nullable: false })
	name: I18nText;

	@JsonColumn({ nullable: false })
	description: I18nText;

	// %% RELATIONS

	@ManyToOne(() => ProgramEntity)
	@JoinColumn({ name: 'program_id' })
	program: ProgramEntity;
}
