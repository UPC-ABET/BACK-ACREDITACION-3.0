import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { TextMediumColumn, TextLargeColumn, IntegerFKIDColumn, IntegerColumn, JsonColumn } from 'src/commons/configs/db.configs';
import { ProgramEntity } from 'src/modules/academic/programs/model/programs.entity';

@Entity({ name: 'notification_messages', schema: 'survey' })
export class NotificationMessageEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerColumn({ nullable: false })
	survey_type_id: number;

	@IntegerFKIDColumn({ nullable: false })
	program_id: number;

	@TextMediumColumn({ nullable: false })
	title: string;

	@TextLargeColumn({ nullable: false })
	body: string;

	@JsonColumn()
	cc_receivers: any;

	// %% RELACIONES

	@ManyToOne(() => ProgramEntity)
	@JoinColumn({ name: 'program_id' })
	program: ProgramEntity;
}
