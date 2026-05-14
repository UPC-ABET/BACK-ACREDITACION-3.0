import { runTenantSeed } from '../seed-runner';

runTenantSeed('organization base module', async (tenantDataSource) => {
	await tenantDataSource.query(`
		INSERT INTO "organization"."campuses" (code, name)
		SELECT v.code, v.name
		FROM (
			VALUES
				('CAMPUS_MON', 'Campus Monterrico'),
				('CAMPUS_SI', 'Campus San Isidro'),
				('CAMPUS_VILLA', 'Campus Villa')
		) AS v(code, name)
		WHERE NOT EXISTS (
			SELECT 1 FROM "organization"."campuses" c WHERE c.code = v.code
		);
	`);

	await tenantDataSource.query(`
		INSERT INTO "organization"."faculties" (code, name)
		SELECT v.code, v.name
		FROM (
			VALUES
				('FAC_ING', 'Facultad de Ingenieria'),
				('FAC_NEG', 'Facultad de Negocios'),
				('FAC_COM', 'Facultad de Comunicaciones')
		) AS v(code, name)
		WHERE NOT EXISTS (
			SELECT 1 FROM "organization"."faculties" f WHERE f.code = v.code
		);
	`);

	await tenantDataSource.query(`
		INSERT INTO "organization"."schools" (faculty_id, code, name)
		SELECT f.id, v.code, v.name
		FROM "organization"."faculties" f
		JOIN (
			VALUES
				('FAC_ING', 'SCH_SOFT', 'Escuela de Ingenieria de Software'),
				('FAC_ING', 'SCH_SIST', 'Escuela de Ingenieria de Sistemas'),
				('FAC_NEG', 'SCH_ADMIN', 'Escuela de Administracion')
		) AS v(faculty_code, code, name)
			ON f.code = v.faculty_code
		WHERE NOT EXISTS (
			SELECT 1 FROM "organization"."schools" s WHERE s.code = v.code
		);
	`);

	await tenantDataSource.query(`
		INSERT INTO "organization"."chart_levels" (level, level_type_id)
		SELECT v.level, t.id
		FROM "core"."types" t
		JOIN (
			VALUES
				(1, 'TG902-T001'),
				(2, 'TG902-T002'),
				(3, 'TG902-T003')
		) AS v(level, level_type_code)
			ON t.code = v.level_type_code
		WHERE NOT EXISTS (
			SELECT 1
			FROM "organization"."chart_levels" cl
			WHERE cl.level = v.level AND cl.level_type_id = t.id
		);
	`);
});
