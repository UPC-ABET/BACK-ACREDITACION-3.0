// @ts-nocheck
import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import unusedImports from 'eslint-plugin-unused-imports';

export default [
	{
		ignores: ['dist', 'node_modules'],
	},

	eslint.configs.recommended,

	{
		files: ['**/*.ts'],
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: {
				project: './tsconfig.json',
			},
			globals: {
				...globals.node,
				...globals.jest,
				Express: 'readonly',
			},
		},
		plugins: {
			'@typescript-eslint': tseslint.plugin,
			'unused-imports': unusedImports,
		},
		rules: {
			// 🔥 base
			'@typescript-eslint/no-unsafe-argument': 'off',
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-floating-promises': 'error',

			// 🔥 imports
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': 'off',
			'unused-imports/no-unused-imports': 'error',

			'unused-imports/no-unused-vars': [
				'off',
				{
					vars: 'all',
					varsIgnorePattern: '^_',
					args: 'after-used',
					argsIgnorePattern: '^_',
				},
			],
		},
	},

	// Plain CommonJS control scripts for the sidecar Docker services (e.g. browser-auth) —
	// not part of the TypeScript project, so they need their own globals instead of falling
	// through to eslint.configs.recommended with none at all. `globals.browser` is included
	// too: these files embed Playwright `page.evaluate`/`waitForFunction` callbacks whose
	// source is statically parsed here even though it actually runs inside the remote page.
	{
		files: ['docker/**/*.js'],
		languageOptions: {
			globals: {
				...globals.node,
				...globals.browser,
			},
		},
	},
];
