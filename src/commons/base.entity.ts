import { PrimaryGeneratedColumn } from 'typeorm';
import { BooleanColumn, DateColumn, JsonColumn } from './configs/db.configs';

export class BaseEntity {
	@PrimaryGeneratedColumn()
	id: number;

	@JsonColumn({ nullable: false, withDefault: true })
	extra?: any;

	@BooleanColumn({ nullable: false, withDefault: true, default: true })
	isActive?: boolean;

	@DateColumn()
	createdAt: Date;

	@DateColumn({ withDefault: false })
	updatedAt: Date;
}
