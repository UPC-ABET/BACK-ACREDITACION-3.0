import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { TextFullColumn, IntegerFKIDColumn, DateColumn } from 'src/commons/configs/db.configs';
import { SurveyEntity } from 'src/modules/evidence/surveys/model/surveys.entity';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';

@Entity({ name: 'notifications', schema: 'survey' })
export class NotificationEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	survey_id: number;

	@IntegerFKIDColumn({ nullable: false })
	notification_status_type_id: number;

	@TextFullColumn({ nullable: false })
	token: string;

	@DateColumn({ nullable: false })
	sent_date: string;

	@DateColumn({ nullable: false })
	max_register_date: string;

	// %% RELATIONS

	@ManyToOne(() => SurveyEntity)
	@JoinColumn({ name: 'survey_id', foreignKeyConstraintName: 'FK_notifications_survey_id' })
	survey: SurveyEntity;

	@ManyToOne(() => TypeEntity)
	@JoinColumn({ name: 'notification_status_type_id', foreignKeyConstraintName: 'FK_notifications_notification_status_type_id' })
	notification_status_type: TypeEntity;
}
