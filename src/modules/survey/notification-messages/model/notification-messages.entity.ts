import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn, IntegerColumn, JsonColumn } from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';
import { ProgramEntity } from 'src/modules/academic/programs/model/programs.entity';

@Entity({ name: 'notification_messages', schema: 'survey' })
export class NotificationMessageEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerColumn({ nullable: false })
	survey_type_id: number;

	@IntegerFKIDColumn({ nullable: false })
	program_id: number;

	@JsonColumn({ nullable: false })
	title: I18nText;

	@JsonColumn({ nullable: false })
	body: I18nText;

	@JsonColumn()
	cc_receivers: unknown;

	// %% RELACIONES

	@ManyToOne(() => ProgramEntity)
	@JoinColumn({ name: 'program_id' })
	program: ProgramEntity;
}
