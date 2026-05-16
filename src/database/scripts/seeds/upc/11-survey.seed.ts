import { runTenantSeed, i18n } from '../seed-runner';

runTenantSeed('survey module', async (tenantDataSource) => {
	const outcomeConfigValues = [
		[
			'OUT_SOFT_01',
			i18n('Pensamiento critico percibido', 'Perceived critical thinking'),
			i18n('Configuracion de encuesta para medir percepcion sobre pensamiento critico.', 'Survey configuration to measure perception about critical thinking.'),
		],
		[
			'OUT_SOFT_02',
			i18n('Comunicacion efectiva percibida', 'Perceived effective communication'),
			i18n('Configuracion de encuesta para medir percepcion sobre comunicacion efectiva.', 'Survey configuration to measure perception about effective communication.'),
		],
		[
			'OUT_SOFT_03',
			i18n('Trabajo en equipo percibido', 'Perceived teamwork'),
			i18n('Configuracion de encuesta para medir percepcion sobre trabajo en equipo.', 'Survey configuration to measure perception about teamwork.'),
		],
		[
			'OUT_SOFT_04',
			i18n('Solucion tecnica percibida', 'Perceived technical solution'),
			i18n('Configuracion de encuesta para medir percepcion sobre solucion tecnica.', 'Survey configuration to measure perception about technical solution.'),
		],
	]
		.map(([oc, name, desc]) => `('${oc}', '${name}'::jsonb, '${desc}'::jsonb)`)
		.join(',\n\t\t\t');

	await tenantDataSource.query(`
		INSERT INTO "survey"."outcome_configs" (
			outcome_id,
			user_outcome_name,
			user_outcome_description
		)
		SELECT outcome.id, v.user_outcome_name, v.user_outcome_description
		FROM (
			VALUES
				${outcomeConfigValues}
		) AS v(outcome_code, user_outcome_name, user_outcome_description)
		JOIN "accreditation"."outcomes" outcome
			ON outcome.outcome_code = v.outcome_code
		WHERE NOT EXISTS (
			SELECT 1 FROM "survey"."outcome_configs" oc WHERE oc.outcome_id = outcome.id
		);
	`);

	const notificationMessageValues = [
		[
			'TG601-T001',
			'PROG_SOFT',
			i18n('Invitacion a encuesta 2026-1', '2026-1 survey invitation'),
			i18n('Te invitamos a completar la encuesta de satisfaccion del periodo 2026-1.', 'We invite you to complete the 2026-1 satisfaction survey.'),
			'["calidad@upc.edu.pe"]',
		],
		[
			'TG601-T001',
			'PROG_SOFT',
			i18n('Recordatorio de encuesta 2026-1', '2026-1 survey reminder'),
			i18n('Aun puedes completar la encuesta de satisfaccion antes de la fecha maxima.', 'You can still complete the satisfaction survey before the deadline.'),
			'["calidad@upc.edu.pe"]',
		],
	]
		.map(([st, pc, title, body, cc]) => `('${st}', '${pc}', '${title}'::jsonb, '${body}'::jsonb, '${cc}'::jsonb)`)
		.join(',\n\t\t\t');

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
				${notificationMessageValues}
		) AS v(survey_type_code, program_code, title, body, cc_receivers)
		JOIN "core"."types" survey_type
			ON survey_type.code = v.survey_type_code
		JOIN "academic"."programs" program
			ON program.code = v.program_code
		WHERE NOT EXISTS (
			SELECT 1
			FROM "survey"."notification_messages" message
			WHERE message.program_id = program.id AND message.title->>'es' = v.title->>'es'
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

	const scoreValues = [
		[20260101, 'OUT_SOFT_01', 4.5, i18n('El curso ayudo a analizar problemas de forma estructurada.', 'The course helped to analyze problems in a structured way.')],
		[20260101, 'OUT_SOFT_04', 4.0, i18n('La practica permitio implementar soluciones verificables.', 'The practice allowed implementing verifiable solutions.')],
		[20260102, 'OUT_SOFT_01', 4.0, i18n('Las actividades fueron retadoras y utiles.', 'The activities were challenging and useful.')],
		[20260102, 'OUT_SOFT_04', 4.25, i18n('El proyecto permitio aplicar conceptos tecnicos.', 'The project allowed applying technical concepts.')],
	]
		.map(([sn, oc, score, comm]) => `(${sn}, '${oc}', ${(score as number).toFixed(6)}, '${comm}'::jsonb)`)
		.join(',\n\t\t\t');

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
				${scoreValues}
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
