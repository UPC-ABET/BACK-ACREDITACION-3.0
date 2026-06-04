import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn, NameColumn } from 'src/commons/configs/db.configs';
import { ProgramEntity } from 'src/modules/academic/programs/model/programs.entity';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';

@Entity({ name: 'research_lines', schema: 'portfolio' })
export class PortfolioResearchLineEntity extends BaseEntity {
	// %% ATTRIBUTES

	@NameColumn({ nullable: false })
	name: string;

	@IntegerFKIDColumn({ nullable: false })
	programId: number;

	@IntegerFKIDColumn({ nullable: false })
	modalityTypeId: number;

	// %% RELATIONS

	@ManyToOne(() => ProgramEntity)
	@JoinColumn({
		name: 'program_id',
		foreignKeyConstraintName: 'FK_portfolio_research_lines_program_id',
	})
	program: ProgramEntity;

	@ManyToOne(() => TypeEntity)
	@JoinColumn({
		name: 'modality_type_id',
		foreignKeyConstraintName: 'FK_portfolio_research_lines_modality_type_id',
	})
	modalityType: TypeEntity;
}
