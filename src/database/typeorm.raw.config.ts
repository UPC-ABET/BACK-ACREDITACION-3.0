import { DataSource } from 'typeorm';
import { UpperPrefixSnakeNamingStrategy } from '../commons/configs/naming-strategy';
import * as dotenv from 'dotenv';

dotenv.config();

export default new DataSource({
	type: 'postgres',
	url: process.env.RAW_DB_URL,
	ssl: process.env.RAW_DB_SSL === 'true' ? { rejectUnauthorized: false } : false,

	synchronize: false,
	logging: false,
	namingStrategy: new UpperPrefixSnakeNamingStrategy(),

	entities: ['src/modules/admin/banner/raw/model/*.entity.ts'],
	migrations: ['src/database/migrations-raw/*.ts'],
});
