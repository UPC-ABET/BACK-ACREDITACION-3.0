import { runTenantSeed } from '../seed-runner';

const i18nJson = (es: string, en?: string) => JSON.stringify({ es, en: en ?? es });

runTenantSeed('ifc notification configs', async (tenantDataSource) => {
	const SCHOOL_CODE = 'EISCB';
	const ACADEMIC_PERIOD_CODE = '202502';

	// Each row: trigger code, status code, to chart-level codes, cc chart-level codes, title (i18n), body (i18n)
	const rows = [
		{
			triggerCode: 'TG1002-T001', // MANUAL
			statusCode: 'TG701-T001', // SAVED
			toCodes: ['TG902-T006'], // COURSE_COORDINATOR
			ccCodes: ['TG902-T005', 'TG902-T004'], // SUBAREA, AREA
			title: i18nJson('Recordatorio: IFC pendiente de envío — {{course_name}}', 'Reminder: IFC pending submission — {{course_name}}'),
			body: i18nJson(
				`<p>Hola {{coordinator_name}},</p>
<p>El IFC del curso <strong>{{course_name}}</strong> correspondiente al periodo {{academic_period}} se encuentra <strong>guardado</strong> pero aún no ha sido enviado a revisión.</p>
<p>Por favor, ingresa al sistema para completarlo y enviarlo: <a href="{{ifc_link}}">{{ifc_link}}</a>.</p>
<p>Notificado por: {{notifier_name}}.</p>`,
				`<p>Hi {{coordinator_name}},</p>
<p>The IFC for <strong>{{course_name}}</strong> (period {{academic_period}}) is currently <strong>saved</strong> but has not yet been submitted for review.</p>
<p>Please log in to complete and submit it: <a href="{{ifc_link}}">{{ifc_link}}</a>.</p>
<p>Notified by: {{notifier_name}}.</p>`,
			),
		},
		{
			triggerCode: 'TG1002-T001', // MANUAL
			statusCode: 'TG701-T004', // OBSERVED
			toCodes: ['TG902-T006'],
			ccCodes: ['TG902-T005', 'TG902-T004'],
			title: i18nJson('IFC con observaciones — {{course_name}}', 'IFC observed — {{course_name}}'),
			body: i18nJson(
				`<p>Hola {{coordinator_name}},</p>
<p>El IFC del curso <strong>{{course_name}}</strong> (periodo {{academic_period}}) fue <strong>observado</strong> por {{observer_name}}.</p>
<p><strong>Comentario:</strong> {{comment}}</p>
<p>Por favor, atiende las observaciones y vuelve a enviarlo: <a href="{{ifc_link}}">{{ifc_link}}</a>.</p>
<p>Notificado por: {{notifier_name}}.</p>`,
				`<p>Hi {{coordinator_name}},</p>
<p>The IFC for <strong>{{course_name}}</strong> (period {{academic_period}}) was <strong>observed</strong> by {{observer_name}}.</p>
<p><strong>Comment:</strong> {{comment}}</p>
<p>Please address the observations and resubmit: <a href="{{ifc_link}}">{{ifc_link}}</a>.</p>
<p>Notified by: {{notifier_name}}.</p>`,
			),
		},
		{
			triggerCode: 'TG1002-T001', // MANUAL
			statusCode: 'TG701-T005', // UNREGISTERED
			toCodes: ['TG902-T006'],
			ccCodes: ['TG902-T005', 'TG902-T004'],
			title: i18nJson('IFC sin registrar — {{course_name}}', 'IFC not yet registered — {{course_name}}'),
			body: i18nJson(
				`<p>Hola {{coordinator_name}},</p>
<p>Aún no se ha registrado el IFC del curso <strong>{{course_name}}</strong> para el periodo {{academic_period}}.</p>
<p>Por favor, ingresa al sistema y créalo: <a href="{{ifc_link}}">{{ifc_link}}</a>.</p>
<p>Notificado por: {{notifier_name}}.</p>`,
				`<p>Hi {{coordinator_name}},</p>
<p>No IFC has been registered yet for <strong>{{course_name}}</strong> (period {{academic_period}}).</p>
<p>Please log in and create it: <a href="{{ifc_link}}">{{ifc_link}}</a>.</p>
<p>Notified by: {{notifier_name}}.</p>`,
			),
		},
		{
			triggerCode: 'TG1002-T002', // AUTO_STATUS_CHANGE
			statusCode: 'TG701-T002', // SUBMITTED
			toCodes: ['TG902-T005'], // SUBAREA_COORDINATOR — the reviewer
			ccCodes: ['TG902-T004', 'TG902-T003'], // AREA + PROGRAM
			title: i18nJson('Nuevo IFC enviado a revisión — {{course_name}}', 'New IFC submitted for review — {{course_name}}'),
			body: i18nJson(
				`<p>Hola,</p>
<p>{{submitter_name}} envió el IFC del curso <strong>{{course_name}}</strong> (periodo {{academic_period}}) para su revisión.</p>
<p>Puedes revisarlo aquí: <a href="{{ifc_link}}">{{ifc_link}}</a>.</p>`,
				`<p>Hi,</p>
<p>{{submitter_name}} has submitted the IFC for <strong>{{course_name}}</strong> (period {{academic_period}}) for review.</p>
<p>You can review it here: <a href="{{ifc_link}}">{{ifc_link}}</a>.</p>`,
			),
		},
	];

	const idsRow = await tenantDataSource.query(
		`
		SELECT
			(SELECT id FROM "organization"."schools"    WHERE code = $1)              AS school_id,
			(SELECT id FROM "academic"."academic_periods" WHERE code = $2)            AS academic_period_id
		`,
		[SCHOOL_CODE, ACADEMIC_PERIOD_CODE],
	);

	const schoolId = idsRow[0]?.school_id;
	const academicPeriodId = idsRow[0]?.academic_period_id;
	if (!schoolId || !academicPeriodId) {
		throw new Error(`No se encontró la escuela con code='${SCHOOL_CODE}' o el periodo con code='${ACADEMIC_PERIOD_CODE}'. (school_id=${schoolId}, academic_period_id=${academicPeriodId})`);
	}

	for (const r of rows) {
		await tenantDataSource.query(
			`
			INSERT INTO "ifc"."notification_configs"
				(school_id, academic_period_id, trigger_type_id, ifc_status_type_id,
				 title, body, to_chart_level_type_ids, cc_chart_level_type_ids, is_active)
			SELECT
				$1::int,
				$2::int,
				(SELECT id FROM "core"."types" WHERE code = $3),
				(SELECT id FROM "core"."types" WHERE code = $4),
				$5::jsonb,
				$6::jsonb,
				COALESCE(
					(SELECT to_jsonb(array_agg(id))
					 FROM "core"."types"
					 WHERE code = ANY($7::text[])),
					'[]'::jsonb
				),
				COALESCE(
					(SELECT to_jsonb(array_agg(id))
					 FROM "core"."types"
					 WHERE code = ANY($8::text[])),
					'[]'::jsonb
				),
				true
			ON CONFLICT ON CONSTRAINT "UQ_4689ce4c54254910a1e7ab56b1c" DO UPDATE
			SET title                     = EXCLUDED.title,
				body                      = EXCLUDED.body,
				to_chart_level_type_ids   = EXCLUDED.to_chart_level_type_ids,
				cc_chart_level_type_ids   = EXCLUDED.cc_chart_level_type_ids,
				is_active                 = true,
				updated_at                = NOW();
			`,
			[schoolId, academicPeriodId, r.triggerCode, r.statusCode, r.title, r.body, r.toCodes, r.ccCodes],
		);
	}
});
