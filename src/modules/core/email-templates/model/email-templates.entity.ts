import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { CodeColumn, IntegerFKIDColumn, JsonColumn } from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';

@Entity({ name: 'email_templates', schema: 'core' })
export class EmailTemplateEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	categoryTypeId: number;

	@CodeColumn({ nullable: false })
	code: string;

	@JsonColumn({ nullable: false })
	name: I18nText;

	@JsonColumn({ nullable: false })
	subject: I18nText;

	@JsonColumn({ nullable: false })
	body: I18nText;

	// %% RELATIONS

	@ManyToOne(() => TypeEntity)
	@JoinColumn({
		name: 'category_type_id',
		foreignKeyConstraintName: 'FK_email_templates_category_type_id',
	})
	categoryType: TypeEntity;
}
