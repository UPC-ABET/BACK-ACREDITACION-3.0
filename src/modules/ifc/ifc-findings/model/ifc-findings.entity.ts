import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn } from 'src/commons/configs/db.configs';
import { FindingEntity } from 'src/modules/improvement/findings/model/findings.entity';
import { IfcEntity } from 'src/modules/evidence/ifcs/model/ifcs.entity';

@Entity({ name: 'ifc_findings', schema: 'ifc' })
export class IfcFindingEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	ifcId: number;

	@IntegerFKIDColumn({ nullable: false })
	findingId: number;

	// %% RELATIONS

	@ManyToOne(() => IfcEntity)
	@JoinColumn({ name: 'ifc_id', foreignKeyConstraintName: 'FK_ifc_findings_ifc_id' })
	ifc: IfcEntity;

	@ManyToOne(() => FindingEntity)
	@JoinColumn({ name: 'finding_id', foreignKeyConstraintName: 'FK_ifc_findings_finding_id' })
	finding: FindingEntity;
}
