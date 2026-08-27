import { APP_GUARD } from '@nestjs/core';

// `AppModule` transitively imports `rubrics.service.ts`, which imports the ESM-only `p-limit`
// package. Jest's CJS transform cannot load it directly; this test only needs `AppModule`'s
// static provider metadata, not `p-limit`'s runtime behavior, so it is stubbed out here.
jest.mock('p-limit', () => ({
	__esModule: true,
	default: () => (fn: (...args: any[]) => any) => fn(),
}));

// `@Module({...})`'s argument (including `ConfigModule.forRoot({ validate: validateEnv })`) is
// evaluated eagerly at class-decoration time, i.e. the moment `app.module.ts` is imported — before
// any test body runs. Env validation must therefore be satisfied here, with throwaway values, so
// merely importing `AppModule` for its static provider metadata does not require a real `.env`.
process.env.NODE_ENV = 'development';
process.env.APP_PORT ??= '3000';
process.env.APP_FRONTEND_URL ??= 'http://localhost:3000';
process.env.DB_TYPE ??= 'postgres';
process.env.DB_HOST ??= 'localhost';
process.env.DB_PORT ??= '5432';
process.env.DB_USER ??= 'test';
process.env.DB_PASSWORD ??= 'test';
process.env.DB_NAME ??= 'test';
process.env.JWT_SECRET ??= 'a'.repeat(32);
process.env.APP_SECRET ??= 'a'.repeat(64);
process.env.DEFAULT_USER_PASSWORD ??= 'password123';
process.env.SMTP_HOST ??= 'localhost';
process.env.SMTP_PORT ??= '587';
process.env.SMTP_USER ??= 'test';
process.env.SMTP_PASS ??= 'test';
process.env.SMTP_FROM ??= 'test@example.com';

import { AppModule } from './app.module';
import { ApiTokenAuthGuard } from './modules/auth/protocols/api-key/guards/api-token-auth.guard';
import { JwtAuthGuard } from './modules/auth/protocols/jwt/guards/jwt-auth.guard';
import { PermissionsGuard } from './modules/auth/protocols/jwt/guards/permissions.guard';

/**
 * Pins the guard-chain registration order at compile-time-adjacent granularity: a reorder in
 * `app.module.ts` fails this suite instead of silently breaking M2M auth or the JWT flow (see the
 * proposal's first risk and design.md D1).
 */
describe('AppModule guard order', () => {
	it('registers APP_GUARD providers in the exact order [ApiTokenAuthGuard, JwtAuthGuard, PermissionsGuard]', () => {
		const providers: any[] = Reflect.getMetadata('providers', AppModule) ?? [];

		const guardOrder = providers
			.filter((provider) => provider && provider.provide === APP_GUARD)
			.map((provider) => provider.useClass);

		expect(guardOrder).toEqual([ApiTokenAuthGuard, JwtAuthGuard, PermissionsGuard]);
	});
});
