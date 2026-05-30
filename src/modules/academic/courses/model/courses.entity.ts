import { Entity } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { CodeColumn, JsonColumn } from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';

@Entity({ name: 'courses', schema: 'academic' })
export class CourseEntity extends BaseEntity {
	// %% ATTRIBUTES

	@CodeColumn({ nullable: false })
	code: string;

	@JsonColumn({ nullable: false })
	name: I18nText;

	@JsonColumn({ nullable: false })
	description: I18nText;

	@JsonColumn({ nullable: false })
	learningOutcome: I18nText;

	// %% RELATIONS
}
