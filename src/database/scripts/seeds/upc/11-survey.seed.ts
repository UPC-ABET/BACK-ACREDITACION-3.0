import { runTenantSeed } from '../seed-runner';

runTenantSeed('survey module', async (tenantDataSource) => {
	await tenantDataSource.query(`
		INSERT INTO "survey"."outcome_configs" (
			outcome_id,
			user_outcome_name,
			user_outcome_description
		)
		SELECT outcome.id, v.user_outcome_name, v.user_outcome_description
		FROM (
			VALUES
				('OUT_SOFT_01', 'Pensamiento critico percibido', 'Configuracion de encuesta para medir percepcion sobre pensamiento critico.'),
				('OUT_SOFT_02', 'Comunicacion efectiva percibida', 'Configuracion de encuesta para medir percepcion sobre comunicacion efectiva.'),
				('OUT_SOFT_03', 'Trabajo en equipo percibido', 'Configuracion de encuesta para medir percepcion sobre trabajo en equipo.'),
				('OUT_SOFT_04', 'Solucion tecnica percibida', 'Configuracion de encuesta para medir percepcion sobre solucion tecnica.')
		) AS v(outcome_code, user_outcome_name, user_outcome_description)
		JOIN "accreditation"."outcomes" outcome
			ON outcome.outcome_code = v.outcome_code
		WHERE NOT EXISTS (
			SELECT 1 FROM "survey"."outcome_configs" oc WHERE oc.outcome_id = outcome.id
		);
	`);

	await tenantDataSource.query(`
		INSERT INTO "survey"."notification_messages" (
			survey_type_id,
			program_id,
			title,
			body,
			cc_receivers
		)
		SELECT survey_type.id, program.id, v.title, v.body, v.cc_receivers
		FROM (
			VALUES
				('TG601-T001', 'PROG_SOFT', 'Invitacion a encuesta 2026-1', 'Te invitamos a completar la encuesta de satisfaccion del periodo 2026-1.', '["calidad@upc.edu.pe"]'::jsonb),
				('TG601-T001', 'PROG_SOFT', 'Recordatorio de encuesta 2026-1', 'Aun puedes completar la encuesta de satisfaccion antes de la fecha maxima.', '["calidad@upc.edu.pe"]'::jsonb)
		) AS v(survey_type_code, program_code, title, body, cc_receivers)
		JOIN "core"."types" survey_type
			ON survey_type.code = v.survey_type_code
		JOIN "academic"."programs" program
			ON program.code = v.program_code
		WHERE NOT EXISTS (
			SELECT 1
			FROM "survey"."notification_messages" message
			WHERE message.program_id = program.id AND message.title = v.title
		);
	`);

	await tenantDataSource.query(`
		INSERT INTO "survey"."notifications" (
			survey_id,
			notification_status_type_id,
			token,
			max_register_date
		)
		SELECT survey.id, notification_status.id, v.token, v.max_register_date::timestamptz
		FROM (
			VALUES
				(20260101, 'TG1001-T002', 'TOKEN-SURVEY-20260101', '2026-07-05 23:59:59'),
				(20260102, 'TG1001-T001', 'TOKEN-SURVEY-20260102', '2026-07-05 23:59:59')
		) AS v(survey_number, notification_status_type_code, token, max_register_date)
		JOIN "evidence"."surveys" survey
			ON survey.survey_number = v.survey_number
		JOIN "core"."types" notification_status
			ON notification_status.code = v.notification_status_type_code
		WHERE NOT EXISTS (
			SELECT 1 FROM "survey"."notifications" notification WHERE notification.token = v.token
		);
	`);

	await tenantDataSource.query(`
		INSERT INTO "survey"."scores" (
			survey_id,
			outcome_id,
			score,
			commentaries
		)
		SELECT survey.id, outcome.id, v.score, v.commentaries
		FROM (
			VALUES
				(20260101, 'OUT_SOFT_01', 4.500000, 'El curso ayudo a analizar problemas de forma estructurada.'),
				(20260101, 'OUT_SOFT_04', 4.000000, 'La practica permitio implementar soluciones verificables.'),
				(20260102, 'OUT_SOFT_01', 4.000000, 'Las actividades fueron retadoras y utiles.'),
				(20260102, 'OUT_SOFT_04', 4.250000, 'El proyecto permitio aplicar conceptos tecnicos.')
		) AS v(survey_number, outcome_code, score, commentaries)
		JOIN "evidence"."surveys" survey
			ON survey.survey_number = v.survey_number
		JOIN "accreditation"."outcomes" outcome
			ON outcome.outcome_code = v.outcome_code
		WHERE NOT EXISTS (
			SELECT 1
			FROM "survey"."scores" score
			WHERE score.survey_id = survey.id AND score.outcome_id = outcome.id
		);
	`);
});
