import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import {
	BooleanColumn,
	CodeColumn,
	IntegerFKIDColumn,
	NameColumn,
} from 'src/commons/configs/db.configs';
import { AcademicPeriodEntity } from 'src/modules/academic/academic-periods/model/academic-periods.entity';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';

@Entity({ name: 'companies', schema: 'portfolio' })
export class PortfolioCompanyEntity extends BaseEntity {
	// %% ATTRIBUTES

	@NameColumn({ nullable: false })
	name: string;

	@CodeColumn({ nullable: false, unique: false })
	code: string;

	@BooleanColumn({ nullable: false, withDefault: true, default: false })
	isFromUPC: boolean;

	@IntegerFKIDColumn({ nullable: false })
	academicPeriodId: number;

	@IntegerFKIDColumn({ nullable: false })
	modalityTypeId: number;

	// %% RELATIONS

	@ManyToOne(() => AcademicPeriodEntity)
	@JoinColumn({
		name: 'academic_period_id',
		foreignKeyConstraintName: 'FK_portfolio_companies_academic_period_id',
	})
	academicPeriod: AcademicPeriodEntity;

	@ManyToOne(() => TypeEntity)
	@JoinColumn({
		name: 'modality_type_id',
		foreignKeyConstraintName: 'FK_portfolio_companies_modality_type_id',
	})
	modalityType: TypeEntity;
}
