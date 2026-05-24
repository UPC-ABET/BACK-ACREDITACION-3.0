import dataSource from '../typeorm.config';

async function test() {
	if (!process.env.DB_HOST || !process.env.DB_NAME) {
		console.error('Missing required env vars: DB_HOST, DB_NAME');
		process.exit(1);
	}

	try {
		await dataSource.initialize();
		console.log('Connected successfully to the database');
		await dataSource.destroy();
	} catch (error) {
		console.error('Connection error:', error);
	}
}

void test();
