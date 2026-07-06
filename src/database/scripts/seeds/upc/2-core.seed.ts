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
			),
			('PARAMETER_USER_NOTIFICATION_VARS',
			 $$ {"es":"Variables de correo de usuario","en":"User email variables"} $$,
			 $$ {"es":"Variables disponibles en plantillas de correo de usuario","en":"Variables available in user email templates"} $$,
			 $$ [
				{"var":"{{first_name}}","description":{"es":"Nombre del usuario","en":"User first name"}},
				{"var":"{{last_name}}","description":{"es":"Apellido del usuario","en":"User last name"}},
				{"var":"{{app_link}}","description":{"es":"Enlace a la aplicacion","en":"Application link"}},
				{"var":"{{reset_link}}","description":{"es":"Enlace para restablecer contraseña","en":"Password reset link"}},
				{"var":"{{expires_minutes}}","description":{"es":"Minutos de vigencia del enlace","en":"Link expiration minutes"}}
			 ] $$
			),
			('PARAMETER_SURVEY_NOTIFICATION_VARS',
			 $$ {"es":"Variables de correo de encuesta","en":"Survey email variables"} $$,
			 $$ {"es":"Variables disponibles en plantillas de correo de encuesta","en":"Variables available in survey email templates"} $$,
			 $$ [
				{"var":"{{student_name}}","description":{"es":"Nombre del alumno","en":"Student name"}},
				{"var":"{{student_code}}","description":{"es":"Codigo del alumno","en":"Student code"}},
				{"var":"{{course_name}}","description":{"es":"Nombre del curso","en":"Course name"}},
				{"var":"{{program_name}}","description":{"es":"Nombre de la carrera","en":"Program name"}},
				{"var":"{{survey_link}}","description":{"es":"Enlace a la encuesta","en":"Survey link"}},
				{"var":"{{token}}","description":{"es":"Token de la encuesta","en":"Survey token"}}
			 ] $$
			)
		) AS v(code, name, description, value)
		WHERE NOT EXISTS (SELECT 1 FROM "core"."parameters" p WHERE p.code = v.code);
	`);

	await tenantDataSource.query(`
		INSERT INTO "core"."email_templates" (category_type_id, code, name, subject, body)
		SELECT category.id, v.code, v.name::jsonb, v.subject::jsonb, v.body::jsonb
		FROM "core"."types" category
		JOIN (VALUES
			(
				'PASSWORD_RESET',
				$$ {"es":"Restablecimiento de contraseña","en":"Password reset"} $$,
				$$ {"es":"Restablece tu contraseña","en":"Reset your password"} $$,
				$$ {"es":"<p>Estimado/a {{first_name}} {{last_name}},</p><p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en la Plataforma de Acreditacion ABET.</p><p>Este enlace para restablecer tu contraseña permanecera vigente durante {{expires_minutes}} minutos.</p><p>Para crear una nueva contraseña, utiliza el siguiente enlace:</p><div style=\\"text-align: center; margin: 30px 0;\\"><a href=\\"{{reset_link}}\\" style=\\"background-color: #d62f2f; color: white; padding: 15px 30px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block;\\">RESTABLECER CONTRASEÑA</a></div><p>Si no solicitaste este cambio, puedes ignorar este correo de forma segura.</p><p>Saludos cordiales,<br>Equipo de Acreditacion ABET</p>","en":"<p>Dear {{first_name}} {{last_name}},</p><p>We received a request to reset the password for your ABET Accreditation Platform account.</p><p>This password reset link will remain valid for {{expires_minutes}} minutes.</p><p>To create a new password, please use the following link:</p><div style=\\"text-align: center; margin: 30px 0;\\"><a href=\\"{{reset_link}}\\" style=\\"background-color: #d62f2f; color: white; padding: 15px 30px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block;\\">RESET PASSWORD</a></div><p>If you did not request this change, you can safely ignore this email.</p><p>Best regards,<br>ABET Accreditation Team</p>"} $$
			)
		) AS v(code, name, subject, body)
			ON category.code = 'TG1004-T001'
		ON CONFLICT ON CONSTRAINT "UQ_email_templates_code" DO UPDATE
		SET
			category_type_id = EXCLUDED.category_type_id,
			name = EXCLUDED.name,
			subject = EXCLUDED.subject,
			body = EXCLUDED.body,
			is_active = TRUE,
			updated_at = NOW();
	`);
}

if (require.main === module) {
	runSeed('core module', loadCoreParameters);
}
