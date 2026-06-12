import { z } from 'zod';

const envSchema = z
	.object({
		NODE_ENV: z.enum(['development', 'staging', 'production']).optional(),
		LOG_LEVEL: z.enum(['error', 'warn', 'log', 'debug', 'verbose']).optional(),

		APP_PORT: z.string().regex(/^\d+$/, 'APP_PORT must be a valid number'),
		APP_FRONTEND_URL: z.string().optional(),
		CORS_ALLOWED_ORIGINS: z.string().optional(),

		DB_TYPE: z.string().min(1, 'DB_TYPE is required'),
		DB_HOST: z.string().min(1, 'DB_HOST is required'),
		DB_PORT: z.string().regex(/^\d+$/, 'DB_PORT must be a valid number'),
		DB_USER: z.string().min(1, 'DB_USER is required'),
		DB_PASSWORD: z.string().min(1, 'DB_PASSWORD is required'),
		DB_NAME: z.string().min(1, 'DB_NAME is required'),
		DB_SSL: z.string().optional(),
		DB_POOL_MAX: z.string().regex(/^\d+$/, 'DB_POOL_MAX must be a number').optional(),
		DB_POOL_IDLE_TIMEOUT: z
			.string()
			.regex(/^\d+$/, 'DB_POOL_IDLE_TIMEOUT must be a number')
			.optional(),
		DB_POOL_CONN_TIMEOUT: z
			.string()
			.regex(/^\d+$/, 'DB_POOL_CONN_TIMEOUT must be a number')
			.optional(),

		JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
		APP_SECRET: z
			.string()
			.min(64, 'APP_SECRET must be at least 64 hex characters')
			.regex(/^[0-9a-fA-F]+$/, 'APP_SECRET must be a hex string'),

		COOKIE_SECRET: z.string().min(32, 'COOKIE_SECRET must be at least 32 characters').optional(),

		DEFAULT_USER_PASSWORD: z.string().min(8, 'DEFAULT_USER_PASSWORD must be at least 8 characters'),

		ID_DIRECTORY_TENANT: z.string().optional(),
		ID_APPLICATION_CLIENT: z.string().optional(),
		MICROSOFT_SECRET: z.string().optional(),
		MICROSOFT_BASE_URL: z.string().url().optional(),
		URL_REDIRECT: z.string().url().optional(),

		SURVEY_BASE_URL: z.string().url().optional(),

		SMTP_HOST: z.string().min(1, 'SMTP_HOST is required'),
		SMTP_PORT: z.string().regex(/^\d+$/, 'SMTP_PORT must be a number'),
		SMTP_USER: z.string().min(1, 'SMTP_USER is required'),
		SMTP_PASS: z.string().min(1, 'SMTP_PASS is required'),
		SMTP_FROM: z.string().email('SMTP_FROM must be a valid email'),
		SMTP_SECURE: z.enum(['true', 'false']).optional(),
		SMTP_REQUIRE_TLS: z.enum(['true', 'false']).optional(),

		PUPPETEER_EXECUTABLE_PATH: z.string().optional(),
	})
	.passthrough()
	.refine(
		(env) => (env.APP_FRONTEND_URL ?? '').length > 0 || (env.CORS_ALLOWED_ORIGINS ?? '').length > 0,
		{ message: 'At least one of APP_FRONTEND_URL or CORS_ALLOWED_ORIGINS must be set' },
	);

export function validateEnv(config: Record<string, unknown>) {
	return envSchema.parse(config);
}
