import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const sslEnabled = (process.env.DB_SSL ?? 'false').toLowerCase() === 'true';

export default new DataSource({
	type: 'postgres',
	host: process.env.DB_HOST,
	port: Number(process.env.DB_PORT),
	username: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_NAME,
	ssl: sslEnabled ? { rejectUnauthorized: false } : false,
});
