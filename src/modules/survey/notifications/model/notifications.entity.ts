import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { TextFullColumn, IntegerFKIDColumn, IntegerColumn, DateColumn } from 'src/commons/configs/db.configs';
import { SurveyEntity } from 'src/modules/evidence/surveys/model/surveys.entity';

@Entity({ name: 'notifications', schema: 'survey' })
export class NotificationEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerFKIDColumn({ nullable: false })
	survey_id: number;

	@IntegerColumn({ nullable: false })
	notification_status_type_id: number;

	@TextFullColumn({ nullable: false })
	token: string;

	@DateColumn({ nullable: false })
	sent_date: string;

	@DateColumn({ nullable: false })
	max_register_date: string;

	// %% RELACIONES

	@ManyToOne(() => SurveyEntity)
	@JoinColumn({ name: 'survey_id' })
	survey: SurveyEntity;
}
