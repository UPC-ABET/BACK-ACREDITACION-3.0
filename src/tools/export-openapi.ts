/**
 * Writes the OpenAPI document to `openapi.json` at the repository root.
 *
 * The spec is a committed artifact: it is the frontend's source of truth for this API,
 * and its diff is how a breaking contract change (a renamed field, a retyped response)
 * becomes visible in review even when nothing in this repo fails to compile.
 *
 *   pnpm openapi:export
 *
 * Regenerate and commit it in the same PR as any change to a route, DTO or response shape.
 *
 * Runs in Nest's `preview` mode, which builds the module graph and registers controller
 * metadata without instantiating providers or running lifecycle hooks. That is what keeps
 * this offline: `SwaggerModule.createDocument` only needs the route metadata the
 * decorators produce, so no database connection is ever opened.
 */
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { format, resolveConfig } from 'prettier';

// MUST stay above the app.module import: it sets RAW_DB_URL, without which the module graph
// omits every scraping endpoint and the exported spec silently loses them. See the file's comment.
import './export-openapi.env';
import { AppModule } from '../app.module';

async function exportOpenApi(): Promise<void> {
	const app = await NestFactory.create(AppModule, {
		// preview: build the module graph without instantiating providers, so TypeORM
		// never tries to connect.
		preview: true,
		// abortOnError must stay false: with it on, Nest terminates the process on an
		// init failure and — with the logger quietened — prints nothing at all.
		abortOnError: false,
		logger: ['error', 'warn'],
	});

	// Keep this in sync with the DocumentBuilder in src/main.ts. If they diverge, the
	// committed spec stops describing what the running service actually serves.
	const config = new DocumentBuilder()
		.setTitle('API Base')
		.setDescription('API Base para UPC')
		.setVersion('1.0')
		.addBearerAuth(
			{
				type: 'http',
				scheme: 'bearer',
				bearerFormat: 'JWT',
			},
			'bearer',
		)
		.addSecurityRequirements('bearer')
		.build();

	const document = SwaggerModule.createDocument(app, config);

	const target = join(process.cwd(), 'openapi.json');

	// Format with the repo's own Prettier config rather than raw JSON.stringify.
	// lint-staged runs `prettier --write` over *.json on commit, so an unformatted
	// artifact would be rewritten after generation — leaving the committed file
	// permanently different from what this script produces, and every regeneration
	// showing a spurious whole-file diff. Formatting here makes the two agree by
	// construction, with no .prettierignore exception to remember.
	const prettierOptions = await resolveConfig(target);
	const formatted = await format(JSON.stringify(document), { ...prettierOptions, parser: 'json' });

	writeFileSync(target, formatted, 'utf8');

	const pathCount = Object.keys(document.paths ?? {}).length;
	const schemaCount = Object.keys(document.components?.schemas ?? {}).length;

	await app.close();

	console.log(`openapi.json written: ${pathCount} paths, ${schemaCount} schemas`);
}

void exportOpenApi().catch((error: unknown) => {
	console.error('Failed to export the OpenAPI document:', error);
	process.exitCode = 1;
});
