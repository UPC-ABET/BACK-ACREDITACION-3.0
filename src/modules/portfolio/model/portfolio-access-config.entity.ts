import { Entity } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { BooleanColumn, IntegerFKIDColumn, JsonColumn } from 'src/commons/configs/db.configs';

@Entity({ name: 'access_config', schema: 'portfolio' })
export class PortfolioAccessConfigEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false, unique: true })
	userId: number;

	@BooleanColumn({ nullable: false, default: false })
	fullAccess: boolean;

	@JsonColumn({ nullable: false, default: () => "'[]'" })
	allowedPrefixes: string[];
}
