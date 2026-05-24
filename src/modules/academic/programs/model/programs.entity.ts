import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { CodeColumn, IntegerFKIDColumn, JsonColumn } from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';

@Entity({ name: 'programs', schema: 'academic' })
export class ProgramEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	modality_type_id: number;

	@CodeColumn({ nullable: false })
	code: string;

	@JsonColumn({ nullable: false })
	name: I18nText;

	@JsonColumn({ nullable: false })
	degree: I18nText;

	// %% RELATIONS

	@ManyToOne(() => TypeEntity)
	@JoinColumn({ name: 'modality_type_id' })
	modality_type: TypeEntity;
}
