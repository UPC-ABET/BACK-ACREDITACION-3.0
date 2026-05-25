import { z } from 'zod';

const envSchema = z
	.object({
		NODE_ENV: z.enum(['development', 'staging', 'production']).optional(),

		APP_PORT: z.string().regex(/^\d+$/, 'APP_PORT must be a valid number'),
		APP_FRONTEND_URL: z.string().optional(),
		CORS_ALLOWED_ORIGINS: z.string().optional(),

		DB_TYPE: z.string().min(1, 'DB_TYPE is required'),
		DB_HOST: z.string().min(1, 'DB_HOST is required'),
		DB_PORT: z.string().regex(/^\d+$/, 'DB_PORT must be a valid number'),
		DB_USER: z.string().min(1, 'DB_USER is required'),
		DB_PASSWORD: z.string().min(1, 'DB_PASSWORD is required'),
		DB_NAME: z.string().min(1, 'DB_NAME is required'),

		JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
		APP_SECRET: z
			.string()
			.min(64, 'APP_SECRET must be at least 64 hex characters')
			.regex(/^[0-9a-fA-F]+$/, 'APP_SECRET must be a hex string'),

		COOKIE_SECRET: z.string().min(32, 'COOKIE_SECRET must be at least 32 characters').optional(),

		POSTMARK_API_KEY: z.string().min(1, 'POSTMARK_API_KEY is required'),
		POSTMARK_FROM_EMAIL: z.string().min(1, 'POSTMARK_FROM_EMAIL is required'),
	})
	.passthrough()
	.refine(
		(env) => (env.APP_FRONTEND_URL ?? '').length > 0 || (env.CORS_ALLOWED_ORIGINS ?? '').length > 0,
		{ message: 'At least one of APP_FRONTEND_URL or CORS_ALLOWED_ORIGINS must be set' },
	);

export function validateEnv(config: Record<string, unknown>) {
	return envSchema.parse(config);
}
