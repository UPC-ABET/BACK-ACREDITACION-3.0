import { Entity, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn, JsonColumn } from 'src/commons/configs/db.configs';
import { AcademicPeriodEntity } from 'src/modules/academic/academic-periods/model/academic-periods.entity';
import { SchoolEntity } from 'src/modules/organization/schools/model/schools.entity';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';
import { EmailTemplateEntity } from 'src/modules/core/email-templates/model/email-templates.entity';

@Entity({ name: 'notification_configs', schema: 'ifc' })
@Unique('UQ_notification_configs_school_period_trigger_status', [
	'schoolId',
	'academicPeriodId',
	'triggerTypeId',
	'ifcStatusTypeId',
])
export class NotificationConfigEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	schoolId: number;

	@IntegerFKIDColumn({ nullable: false })
	academicPeriodId: number;

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

	@ManyToOne(() => SchoolEntity)
	@JoinColumn({ name: 'school_id', foreignKeyConstraintName: 'FK_notification_configs_school_id' })
	school: SchoolEntity;

	@ManyToOne(() => AcademicPeriodEntity)
	@JoinColumn({
		name: 'academic_period_id',
		foreignKeyConstraintName: 'FK_notification_configs_academic_period_id',
	})
	academicPeriod: AcademicPeriodEntity;

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
