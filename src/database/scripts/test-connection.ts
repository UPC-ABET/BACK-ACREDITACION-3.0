import dataSource from '../typeorm.config';

async function test() {
	try {
		await dataSource.initialize();
		console.log('✅ Conectado correctamente a la base de datos');
		await dataSource.destroy();
	} catch (error) {
		console.error('❌ Error de conexión:', error);
	}
}

void test();
