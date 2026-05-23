import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixColumnCaseId1748070000000 implements MigrationInterface {
	name = 'FixColumnCaseId1748070000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Rename every column ending in `_Id` (capital I) to its all-lowercase equivalent.
		// This corrects a naming-convention mismatch between the C#/EF source DB
		// (which used PascalCase-derived `_Id`) and the TypeORM entities (which use `_id`).
		// Uses information_schema so it is idempotent: runs only on columns that still
		// have the wrong casing.
		await queryRunner.query(`
			DO $$
			DECLARE
				r      RECORD;
				new_nm TEXT;
			BEGIN
				FOR r IN
					SELECT table_schema, table_name, column_name
					FROM   information_schema.columns
					WHERE  column_name ~ '.*_Id$'
					  AND  table_schema IN (
					         'academic', 'accreditation', 'organization',
					         'evidence', 'survey', 'improvement',
					         'ifc', 'evaluation', 'core'
					       )
					ORDER BY table_schema, table_name, column_name
				LOOP
					new_nm := lower(r.column_name);
					EXECUTE format(
						'ALTER TABLE %I.%I RENAME COLUMN %I TO %I',
						r.table_schema, r.table_name, r.column_name, new_nm
					);
					RAISE NOTICE 'Renamed %.%.% → %',
						r.table_schema, r.table_name, r.column_name, new_nm;
				END LOOP;
			END $$;
		`);
	}

	public async down(_queryRunner: QueryRunner): Promise<void> {
		// Intentionally empty – reverting to the broken casing is not safe.
	}
}
