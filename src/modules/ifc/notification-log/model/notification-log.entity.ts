import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { EmailColumn, IntegerFKIDColumn, JsonColumn } from 'src/commons/configs/db.configs';
import { ChartEntity } from 'src/modules/organization/charts/model/charts.entity';
import { IfcEntity } from 'src/modules/evidence/ifcs/model/ifcs.entity';
import { NotificationConfigEntity } from 'src/modules/ifc/notification-configs/model/notification-configs.entity';
import { UserEntity } from 'src/modules/organization/users/model/users.entity';

@Entity({ name: 'notification_logs', schema: 'ifc' })
export class NotificationLogEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: true, indexed: true, indexName: 'IDX_notification_logs_ifc_id' })
	ifc_id: number | null;

	@IntegerFKIDColumn({
		nullable: false,
		indexed: true,
		indexName: 'IDX_notification_logs_chart_id',
	})
	chart_id: number;

	@IntegerFKIDColumn({ nullable: false })
	notification_config_id: number;

	@IntegerFKIDColumn({ nullable: true })
	notifier_user_id: number | null;

	@JsonColumn({ nullable: false, default: () => "'[]'" })
	to_staff_ids: number[];

	@JsonColumn({ nullable: false, default: () => "'[]'" })
	cc_staff_ids: number[];

	@EmailColumn({ nullable: true })
	provider_message_id: string | null;

	// %% RELATIONS

	@ManyToOne(() => IfcEntity)
	@JoinColumn({ name: 'ifc_id', foreignKeyConstraintName: 'FK_notification_logs_ifc_id' })
	ifc: IfcEntity | null;

	@ManyToOne(() => ChartEntity)
	@JoinColumn({ name: 'chart_id', foreignKeyConstraintName: 'FK_notification_logs_chart_id' })
	chart: ChartEntity;

	@ManyToOne(() => NotificationConfigEntity)
	@JoinColumn({
		name: 'notification_config_id',
		foreignKeyConstraintName: 'FK_notification_logs_notification_config_id',
	})
	notification_config: NotificationConfigEntity;

	@ManyToOne(() => UserEntity)
	@JoinColumn({
		name: 'notifier_user_id',
		foreignKeyConstraintName: 'FK_notification_logs_notifier_user_id',
	})
	notifier_user: UserEntity | null;
}
