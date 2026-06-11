import { DataSource } from 'typeorm';
import { runSeed, i18n } from '../seed-runner';

export async function loadOrganization(tenantDataSource: DataSource) {
	const campusValues = [
		['MON', i18n('Campus Monterrico', 'Monterrico Campus')],
		['SI', i18n('Campus San Isidro', 'San Isidro Campus')],
		['VILLA', i18n('Campus Villa', 'Villa Campus')],
		['SM', i18n('Campus San Miguel', 'San Miguel Campus')],
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
		['ING', i18n('Facultad de Ingenieria', 'Faculty of Engineering')],
		['NEG', i18n('Facultad de Negocios', 'Faculty of Business')],
		['COM', i18n('Facultad de Comunicaciones', 'Faculty of Communications')],
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
		[
			'ING',
			'EISCB',
			i18n(
				'Escuela de Ingenieria de Sistemas y Ciberseguridad',
				'School of Systems and Cybersecurity Engineering',
			),
		],
		[
			'ING',
			'EISCC',
			i18n(
				'Escuela de Ingenieria de Software y Ciencias de la Computacion',
				'School of Software Engineering and Computer Science',
			),
		],
		[
			'ING',
			'ESCEL',
			i18n(
				'Escuela de Ingenieria Electronica, Mecatronica y Redes',
				'School of Electronics, Mechatronics and Networks Engineering',
			),
		],
		[
			'ING',
			'INGAMB',
			i18n('Escuela de Ingenieria Ambiental', 'School of Environmental Engineering'),
		],
		['ING', 'INGBIO', i18n('Escuela de Ingenieria Biomedica', 'School of Biomedical Engineering')],
		['ING', 'INGCIV', i18n('Escuela de Ingenieria Civil', 'School of Civil Engineering')],
		[
			'ING',
			'INGGMI',
			i18n('Escuela de Ingenieria de Gestion Minera', 'School of Mining Management Engineering'),
		],
		[
			'ING',
			'INGGEM',
			i18n(
				'Escuela de Ingenieria de Gestion Empresarial',
				'School of Business Management Engineering',
			),
		],
		['ING', 'INGIND', i18n('Escuela de Ingenieria Industrial', 'School of Industrial Engineering')],
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
}

if (require.main === module) {
	runSeed('organization base module', loadOrganization);
}
