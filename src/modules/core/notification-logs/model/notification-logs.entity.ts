import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import {
	IntegerFKIDColumn,
	JsonColumn,
	NameColumn,
	TextFullColumn,
} from 'src/commons/configs/db.configs';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';
import { EmailTemplateEntity } from 'src/modules/core/email-templates/model/email-templates.entity';
import { UserEntity } from 'src/modules/organization/users/model/users.entity';

/*
 * Generic, cross-domain email notification audit log (core schema).
 * The "what was this about" reference is intentionally a JSONB `context` blob
 * (e.g. { ifcId, chartId, configId } | { programId, surveyTypeId } | { userId })
 * rather than per-domain FKs, since a log is append-only and not read for integrity.
 */
@Entity({ name: 'notification_logs', schema: 'core' })
export class NotificationLogEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	categoryTypeId: number;

	@IntegerFKIDColumn({ nullable: true })
	emailTemplateId: number | null;

	@IntegerFKIDColumn({ nullable: true })
	notifierUserId: number | null;

	@IntegerFKIDColumn({ nullable: false })
	statusTypeId: number;

	@JsonColumn({ nullable: false, default: () => "'[]'" })
	toEmails: string[];

	@JsonColumn({ nullable: false, default: () => "'[]'" })
	ccEmails: string[];

	@JsonColumn({ nullable: false, default: () => "'[]'" })
	toStaffIds: number[];

	@JsonColumn({ nullable: false, default: () => "'[]'" })
	ccStaffIds: number[];

	@NameColumn({ nullable: true })
	providerMessageId: string | null;

	@TextFullColumn({ nullable: true })
	errorMessage: string | null;

	@JsonColumn({ nullable: false })
	context: Record<string, unknown>;

	// %% RELATIONS

	@ManyToOne(() => TypeEntity)
	@JoinColumn({
		name: 'category_type_id',
		foreignKeyConstraintName: 'FK_notification_logs_category_type_id',
	})
	categoryType: TypeEntity;

	@ManyToOne(() => TypeEntity)
	@JoinColumn({
		name: 'status_type_id',
		foreignKeyConstraintName: 'FK_notification_logs_status_type_id',
	})
	statusType: TypeEntity;

	@ManyToOne(() => EmailTemplateEntity)
	@JoinColumn({
		name: 'email_template_id',
		foreignKeyConstraintName: 'FK_notification_logs_email_template_id',
	})
	emailTemplate: EmailTemplateEntity | null;

	@ManyToOne(() => UserEntity)
	@JoinColumn({
		name: 'notifier_user_id',
		foreignKeyConstraintName: 'FK_notification_logs_notifier_user_id',
	})
	notifierUser: UserEntity | null;
}
