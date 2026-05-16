import { Entity } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { NameColumn, JsonColumn } from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';

@Entity({ name: 'accreditors', schema: 'accreditation' })
export class AccreditorEntity extends BaseEntity {
	// %% ATRIBUTOS

	@NameColumn({ nullable: false })
	code: string;

	@JsonColumn({ nullable: false })
	name: I18nText;

	// %% RELACIONES
}
