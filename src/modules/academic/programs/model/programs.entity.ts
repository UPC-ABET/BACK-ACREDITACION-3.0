import { Entity } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { CodeColumn, IntegerColumn, JsonColumn } from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';

@Entity({ name: 'programs', schema: 'academic' })
export class ProgramEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerColumn({ nullable: false })
	modality_type_id: number;

	@CodeColumn({ nullable: false })
	code: string;

	@JsonColumn({ nullable: false })
	name: I18nText;

	@JsonColumn({ nullable: false })
	degree: I18nText;

	// %% RELACIONES
}
