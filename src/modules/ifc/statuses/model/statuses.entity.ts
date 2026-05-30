import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn, DateColumn, JsonColumn } from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';
import { IfcEntity } from 'src/modules/evidence/ifcs/model/ifcs.entity';
import { StaffEntity } from 'src/modules/organization/staff/model/staff.entity';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';

@Entity({ name: 'statuses', schema: 'ifc' })
export class StatusEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	ifcId: number;

	@IntegerFKIDColumn({ nullable: false })
	statusTypeId: number;

	@IntegerFKIDColumn({ nullable: false })
	staffId: number;

	@JsonColumn({ nullable: true })
	comment: I18nText;

	@DateColumn({ nullable: false })
	registerAt: Date;

	// %% RELATIONS

	@ManyToOne(() => IfcEntity)
	@JoinColumn({ name: 'ifc_id', foreignKeyConstraintName: 'FK_statuses_ifc_id' })
	ifc: IfcEntity;

	@ManyToOne(() => TypeEntity)
	@JoinColumn({ name: 'status_type_id', foreignKeyConstraintName: 'FK_statuses_status_type_id' })
	statusType: TypeEntity;

	@ManyToOne(() => StaffEntity)
	@JoinColumn({ name: 'staff_id', foreignKeyConstraintName: 'FK_statuses_staff_id' })
	staff: StaffEntity;
}
