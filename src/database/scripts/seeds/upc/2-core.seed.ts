import { DataSource } from 'typeorm';
import { runSeed, i18n } from '../seed-runner';

export async function loadCoreParameters(tenantDataSource: DataSource) {
	const baseParams: Array<[string, string, string, string]> = [
		[
			'PARAMETER_ACADEMIC_START_DATE',
			i18n('Fecha de inicio academico', 'Academic start date'),
			i18n(
				'Fecha referencial de inicio del periodo academico',
				'Reference start date of the academic period',
			),
			'{"month":3,"day":18}',
		],
		[
			'PARAMETER_ACADEMIC_END_DATE',
			i18n('Fecha de cierre academico', 'Academic end date'),
			i18n(
				'Fecha referencial de cierre del periodo academico',
				'Reference end date of the academic period',
			),
			'{"month":7,"day":20}',
		],
		[
			'PARAMETER_MIN_PASSING_GRADE',
			i18n('Nota minima aprobatoria', 'Minimum passing grade'),
			i18n(
				'Nota minima requerida para aprobar una evaluacion',
				'Minimum grade required to pass an evaluation',
			),
			'{"value":13,"scale":20}',
		],
		[
			'PARAMETER_INSTITUTIONAL_NAME',
			i18n('Nombre institucional', 'Institutional name'),
			i18n('Nombre oficial de la institucion', 'Official name of the institution'),
			'{"name":"Universidad Peruana de Ciencias Aplicadas"}',
		],
		[
			'PARAMETER_INSTITUTIONAL_ACRONYM',
			i18n('Acronimo institucional', 'Institutional acronym'),
			i18n('Acronimo oficial de la institucion', 'Official acronym of the institution'),
			'{"acronym":"UPC"}',
		],
	];

	const baseValues = baseParams
		.map(
			([code, name, description, value]) =>
				`('${code}', '${name}'::jsonb, '${description}'::jsonb, '${value}'::jsonb)`,
		)
		.join(',\n\t\t\t');

	await tenantDataSource.query(`
		INSERT INTO "core"."parameters" (code, name, description, value)
		SELECT v.code, v.name, v.description, v.value
		FROM (
			VALUES
				${baseValues}
		) AS v(code, name, description, value)
		WHERE NOT EXISTS (
			SELECT 1 FROM "core"."parameters" p WHERE p.code = v.code
		);
	`);

	await tenantDataSource.query(`
		INSERT INTO "core"."parameters" (code, name, description, value)
		SELECT v.code, v.name::jsonb, v.description::jsonb, v.value::jsonb
		FROM (VALUES
			('PARAMETER_LANGUAGES',
			 $$ {"es":"Idiomas","en":"Languages"} $$,
			 $$ {"es":"Codigos de idiomas soportados","en":"Supported language codes"} $$,
			 $$ ["en","es"] $$
			),
			('PARAMETER_FINDING_PREFIX',
			 $$ {"es":"Prefijo de hallazgo","en":"Finding prefix"} $$,
			 $$ {"es":"Prefijo para codigos generados de hallazgos","en":"Prefix used to compose finding codes"} $$,
			 $$ "H" $$
			),
			('PARAMETER_ACTION_PREFIX',
			 $$ {"es":"Prefijo de accion","en":"Action prefix"} $$,
			 $$ {"es":"Prefijo para codigos generados de acciones","en":"Prefix used to compose action codes"} $$,
			 $$ "A" $$
			),
			('PARAMETER_IFC_FIELDS',
			 $$ {"es":"Campos del IFC","en":"IFC fields"} $$,
			 $$ {"es":"Definicion de los campos dinamicos del IFC (key, label, required, order)","en":"Dynamic IFC field definitions (key, label, required, order)"} $$,
			 $$ [] $$
			),
			('PARAMETER_IFC_NOTIFICATION_VARS',
			 $$ {"es":"Variables de notificacion IFC","en":"IFC notification variables"} $$,
			 $$ {"es":"Variables disponibles en plantillas de notificacion","en":"Variables available in notification templates"} $$,
			 $$ [
				{"var":"{{coordinator_name}}","description":{"es":"Nombre completo del coordinador de curso","en":"Course coordinator full name"},"valid_status_codes":null},
				{"var":"{{course_name}}","description":{"es":"Nombre del curso","en":"Course name"},"valid_status_codes":null},
				{"var":"{{academic_period}}","description":{"es":"Codigo del periodo academico","en":"Academic period code"},"valid_status_codes":null},
				{"var":"{{notifier_name}}","description":{"es":"Nombre de quien envio la notificacion","en":"Notifier name"},"valid_status_codes":null},
				{"var":"{{ifc_link}}","description":{"es":"Enlace directo al IFC","en":"Direct link to the IFC"},"valid_status_codes":null},
				{"var":"{{observer_name}}","description":{"es":"Quien observo el IFC","en":"Who observed the IFC"},"valid_status_codes":["TG701-T004"]},
				{"var":"{{comment}}","description":{"es":"Comentario de observacion","en":"Observation comment"},"valid_status_codes":["TG701-T004"]},
				{"var":"{{submitter_name}}","description":{"es":"Quien envio el IFC","en":"Who submitted the IFC"},"valid_status_codes":["TG701-T002"]}
			 ] $$
			)
		) AS v(code, name, description, value)
		WHERE NOT EXISTS (SELECT 1 FROM "core"."parameters" p WHERE p.code = v.code);
	`);
}

if (require.main === module) {
	runSeed('core module', loadCoreParameters);
}
