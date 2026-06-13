import { Column, Entity } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { BooleanColumn, IntegerFKIDColumn } from 'src/commons/configs/db.configs';

@Entity({ name: 'access_config', schema: 'portfolio' })
export class PortfolioAccessConfigEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false, unique: true })
	userId: number;

	@BooleanColumn({ nullable: false, withDefault: true, default: false })
	fullAccess: boolean;

	// Array of relative S3 prefixes, e.g. ["EPE/IS/", "Pregrado/CC/2024/"]
	@Column({ name: 'allowed_prefixes', type: 'jsonb', nullable: false, default: () => "'[]'" })
	allowedPrefixes: string[];
}
