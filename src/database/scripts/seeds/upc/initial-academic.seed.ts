import { runTenantSeed, i18n } from '../seed-runner';

// Initial baseline: only the structural academic data (academic periods + programs).
// Courses, study plans, sections, students, enrollments and grades are intentionally
// omitted here — those are loaded later through the bulk upload process.
runTenantSeed('initial academic (periods + programs)', async (tenantDataSource) => {
	await tenantDataSource.query(`
		INSERT INTO "academic"."academic_periods" ("modality_type_id", code, start_date, end_date)
		SELECT t.id, v.code, v.start_date::timestamptz, v.end_date::timestamptz
		FROM "core"."types" t
		JOIN (
			VALUES
				('TG102-T001', '202502', '2025-08-15', '2025-12-15'),
				('TG102-T001', '202601', '2026-09-01', '2026-12-20'),
				('TG102-T001', '202602', '2026-12-21', '2027-04-15')
		) AS v(modality_type_code, code, start_date, end_date)
			ON t.code = v.modality_type_code
		WHERE NOT EXISTS (
			SELECT 1 FROM "academic"."academic_periods" ap WHERE ap.code = v.code
		);
	`);

	const programValues = [
		[
			'TG102-T001',
			'PROG_SOFT',
			i18n('Ingenieria de Software', 'Software Engineering'),
			i18n('Bachiller', 'Bachelor'),
		],
		[
			'TG102-T001',
			'PROG_SIST',
			i18n('Ingenieria de Sistemas', 'Systems Engineering'),
			i18n('Bachiller', 'Bachelor'),
		],
		[
			'TG102-T001',
			'PROG_ADMIN',
			i18n('Administracion de Empresas', 'Business Administration'),
			i18n('Bachiller', 'Bachelor'),
		],
		[
			'TG102-T001',
			'CS',
			i18n('Ciencias de la Computacion', 'Computer Science'),
			i18n('Bachiller', 'Bachelor'),
		],
	]
		.map(
			([modality, code, name, degree]) =>
				`('${modality}', '${code}', '${name}'::jsonb, '${degree}'::jsonb)`,
		)
		.join(',\n\t\t\t');

	await tenantDataSource.query(`
		INSERT INTO "academic"."programs" (modality_type_id, code, name, degree)
		SELECT t.id, v.code, v.name, v.degree
		FROM "core"."types" t
		JOIN (
			VALUES
				${programValues}
		) AS v(modality_type_code, code, name, degree)
			ON t.code = v.modality_type_code
		WHERE NOT EXISTS (
			SELECT 1 FROM "academic"."programs" p WHERE p.code = v.code
		);
	`);
});
