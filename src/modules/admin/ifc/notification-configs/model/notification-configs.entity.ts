import { Entity, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn, JsonColumn } from 'src/commons/configs/db.configs';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';
import { EmailTemplateEntity } from 'src/modules/core/email-templates/model/email-templates.entity';

@Entity({ name: 'notification_configs', schema: 'ifc' })
@Unique('UQ_notification_configs_trigger_status', ['triggerTypeId', 'ifcStatusTypeId'])
export class NotificationConfigEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	triggerTypeId: number;

	@IntegerFKIDColumn({ nullable: false })
	ifcStatusTypeId: number;

	@IntegerFKIDColumn({ nullable: false })
	emailTemplateId: number;

	@JsonColumn({ nullable: false, default: () => "'[]'" })
	toChartEntityTypeIds: string[];

	@JsonColumn({ nullable: false, default: () => "'[]'" })
	ccChartEntityTypeIds: string[];

	// %% RELATIONS

	@ManyToOne(() => TypeEntity)
	@JoinColumn({
		name: 'trigger_type_id',
		foreignKeyConstraintName: 'FK_notification_configs_trigger_type_id',
	})
	triggerType: TypeEntity;

	@ManyToOne(() => TypeEntity)
	@JoinColumn({
		name: 'ifc_status_type_id',
		foreignKeyConstraintName: 'FK_notification_configs_ifc_status_type_id',
	})
	ifcStatusType: TypeEntity;

	@ManyToOne(() => EmailTemplateEntity)
	@JoinColumn({
		name: 'email_template_id',
		foreignKeyConstraintName: 'FK_notification_configs_email_template_id',
	})
	emailTemplate: EmailTemplateEntity;
}
