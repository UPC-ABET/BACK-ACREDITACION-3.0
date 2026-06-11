import { DataSource } from 'typeorm';
import { UpperPrefixSnakeNamingStrategy } from '../commons/configs/naming-strategy';
import * as dotenv from 'dotenv';

dotenv.config();

export default new DataSource({
	type: 'postgres',
	host: process.env.DB_HOST,
	port: Number(process.env.DB_PORT),
	username: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_NAME,
	ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,

	synchronize: false,
	logging: false,
	namingStrategy: new UpperPrefixSnakeNamingStrategy(),

	entities: ['src/**/*.entity.ts'],
	migrations: ['src/database/migrations/*.ts'],
});
