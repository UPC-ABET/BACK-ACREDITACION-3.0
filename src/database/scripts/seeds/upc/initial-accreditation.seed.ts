import { runTenantSeed, i18n } from '../seed-runner';

// Initial baseline: only accreditors and commissions. Program<->commission links,
// outcomes and course-outcome mappings are intentionally omitted here — those are loaded
// later through the bulk upload process.
runTenantSeed('initial accreditation (accreditors + commissions)', async (tenantDataSource) => {
	const accreditorValues = [
		[
			'ACC_SINEACE',
			i18n(
				'Sistema Nacional de Evaluacion, Acreditacion y Certificacion de la Calidad Educativa',
				'National System of Evaluation, Accreditation and Certification of Educational Quality',
			),
		],
		[
			'ACC_ICACIT',
			i18n(
				'Instituto de Calidad y Acreditacion de Programas de Computacion, Ingenieria y Tecnologia',
				'Institute of Quality and Accreditation of Computing, Engineering and Technology Programs',
			),
		],
		['ACC_EISCB', i18n('Acreditadora EISCB', 'EISCB Accreditor')],
	]
		.map(([code, name]) => `('${code}', '${name}'::jsonb)`)
		.join(',\n\t\t\t');

	await tenantDataSource.query(`
		INSERT INTO "accreditation"."accreditors" (code, name)
		SELECT v.code, v.name
		FROM (
			VALUES
				${accreditorValues}
		) AS v(code, name)
		WHERE NOT EXISTS (
			SELECT 1 FROM "accreditation"."accreditors" a WHERE a.code = v.code
		);
	`);

	const commissionValues = [
		[
			'ACC_ICACIT',
			'COM_SOFT_2026',
			i18n(
				'Comision de acreditacion de Ingenieria de Software',
				'Software Engineering accreditation commission',
			),
		],
		[
			'ACC_SINEACE',
			'COM_ADMIN_2026',
			i18n(
				'Comision de acreditacion de Administracion',
				'Business Administration accreditation commission',
			),
		],
		['ACC_EISCB', 'COM_CS', i18n('Comision de acreditacion CS', 'CS Accreditation Commission')],
	]
		.map(([accreditorCode, code, name]) => `('${accreditorCode}', '${code}', '${name}'::jsonb)`)
		.join(',\n\t\t\t');

	await tenantDataSource.query(`
		INSERT INTO "accreditation"."commissions" (accreditor_id, code, name)
		SELECT accreditor.id, v.code, v.name
		FROM "accreditation"."accreditors" accreditor
		JOIN (
			VALUES
				${commissionValues}
		) AS v(accreditor_code, code, name)
			ON accreditor.code = v.accreditor_code
		WHERE NOT EXISTS (
			SELECT 1 FROM "accreditation"."commissions" c WHERE c.code = v.code
		);
	`);
});
