import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn, JsonColumn } from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';
import { ProgramEntity } from 'src/modules/academic/programs/model/programs.entity';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';

@Entity({ name: 'notification_messages', schema: 'survey' })
export class NotificationMessageEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	survey_type_id: number;

	@IntegerFKIDColumn({ nullable: false })
	program_id: number;

	@JsonColumn({ nullable: false })
	title: I18nText;

	@JsonColumn({ nullable: false })
	body: I18nText;

	@JsonColumn()
	cc_receivers: unknown;

	// %% RELATIONS

	@ManyToOne(() => TypeEntity)
	@JoinColumn({ name: 'survey_type_id', foreignKeyConstraintName: 'FK_notification_messages_survey_type_id' })
	survey_type: TypeEntity;

	@ManyToOne(() => ProgramEntity)
	@JoinColumn({ name: 'program_id', foreignKeyConstraintName: 'FK_notification_messages_program_id' })
	program: ProgramEntity;
}
