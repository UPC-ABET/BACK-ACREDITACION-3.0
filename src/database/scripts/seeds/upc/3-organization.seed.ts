import { runTenantSeed, i18n } from '../seed-runner';

runTenantSeed('organization base module', async (tenantDataSource) => {
	const campusValues = [
		['CAMPUS_MON', i18n('Campus Monterrico', 'Monterrico Campus')],
		['CAMPUS_SI', i18n('Campus San Isidro', 'San Isidro Campus')],
		['CAMPUS_VILLA', i18n('Campus Villa', 'Villa Campus')],
	]
		.map(([code, name]) => `('${code}', '${name}'::jsonb)`)
		.join(',\n\t\t\t');

	await tenantDataSource.query(`
		INSERT INTO "organization"."campuses" (code, name)
		SELECT v.code, v.name
		FROM (
			VALUES
				${campusValues}
		) AS v(code, name)
		WHERE NOT EXISTS (
			SELECT 1 FROM "organization"."campuses" c WHERE c.code = v.code
		);
	`);

	const facultyValues = [
		['FAC_ING', i18n('Facultad de Ingenieria', 'Faculty of Engineering')],
		['FAC_NEG', i18n('Facultad de Negocios', 'Faculty of Business')],
		['FAC_COM', i18n('Facultad de Comunicaciones', 'Faculty of Communications')],
	]
		.map(([code, name]) => `('${code}', '${name}'::jsonb)`)
		.join(',\n\t\t\t');

	await tenantDataSource.query(`
		INSERT INTO "organization"."faculties" (code, name)
		SELECT v.code, v.name
		FROM (
			VALUES
				${facultyValues}
		) AS v(code, name)
		WHERE NOT EXISTS (
			SELECT 1 FROM "organization"."faculties" f WHERE f.code = v.code
		);
	`);

	const schoolValues = [
		['FAC_ING', 'SCH_SOFT', i18n('Escuela de Ingenieria de Software', 'School of Software Engineering')],
		['FAC_ING', 'SCH_SIST', i18n('Escuela de Ingenieria de Sistemas', 'School of Systems Engineering')],
		['FAC_NEG', 'SCH_ADMIN', i18n('Escuela de Administracion', 'School of Business Administration')],
	]
		.map(([facultyCode, code, name]) => `('${facultyCode}', '${code}', '${name}'::jsonb)`)
		.join(',\n\t\t\t');

	await tenantDataSource.query(`
		INSERT INTO "organization"."schools" (faculty_id, code, name)
		SELECT f.id, v.code, v.name
		FROM "organization"."faculties" f
		JOIN (
			VALUES
				${schoolValues}
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
