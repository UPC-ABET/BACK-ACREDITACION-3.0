import { runTenantSeed, i18n } from '../seed-runner';

runTenantSeed('ifc status module', async (tenantDataSource) => {
	const statusValues = [
		[
			'Fundamentos de Programacion',
			'AP_2026_1',
			'TG701-T002',
			'calidad@upc.edu.pe',
			i18n(
				'IFC enviado a revision para el periodo 2026-1.',
				'IFC submitted for review for the 2026-1 period.',
			),
			'2026-06-15 09:00:00',
		],
		[
			'Proyecto Integrador de Software',
			'AP_2026_2',
			'TG701-T001',
			'calidad@upc.edu.pe',
			i18n(
				'IFC guardado pendiente de envio para el proyecto integrador.',
				'IFC saved pending submission for the integrator project.',
			),
			'2026-06-16 09:00:00',
		],
		[
			'Algoritmos y Estructuras de Datos',
			'202502',
			'TG701-T001',
			'coord.eiscb@upc.edu.pe',
			i18n('IFC guardado por el coordinador.', 'IFC saved by the coordinator.'),
			'2025-09-01 09:00:00',
		],
		[
			'Bases de Datos',
			'202502',
			'TG701-T001',
			'coord.eiscb@upc.edu.pe',
			i18n('Borrador inicial del IFC.', 'Initial draft of the IFC.'),
			'2025-09-02 09:00:00',
		],
		[
			'Bases de Datos',
			'202502',
			'TG701-T002',
			'coord.eiscb@upc.edu.pe',
			i18n('IFC enviado para revision.', 'IFC submitted for review.'),
			'2025-09-05 14:30:00',
		],
		// 202601 IFCs (year 2026 — exercises the previous_actions feature).
		[
			'Algoritmos y Estructuras de Datos',
			'202601',
			'TG701-T001',
			'coord.eiscb@upc.edu.pe',
			i18n(
				'IFC guardado por el coordinador para el periodo 2026-1.',
				'IFC saved by the coordinator for the 2026-1 period.',
			),
			'2026-09-15 09:00:00',
		],
		[
			'Bases de Datos',
			'202601',
			'TG701-T002',
			'coord.eiscb@upc.edu.pe',
			i18n(
				'IFC enviado a revision para el periodo 2026-1.',
				'IFC submitted for review for the 2026-1 period.',
			),
			'2026-10-02 11:00:00',
		],
	]
		.map(
			([courseName, periodCode, stCode, email, comment, regAt]) =>
				`('${courseName}', '${periodCode}', '${stCode}', '${email}', '${comment}'::jsonb, '${regAt}')`,
		)
		.join(',\n\t\t\t');

	await tenantDataSource.query(`
		INSERT INTO "ifc"."statuses" (
			ifc_id,
			status_type_id,
			staff_id,
			comment,
			register_at
		)
		SELECT ifc.id, status_type.id, staff.id, v.comment, v.register_at::timestamptz
		FROM (
			VALUES
				${statusValues}
		) AS v(course_name, academic_period_code, status_type_code, staff_email, comment, register_at)
		JOIN "academic"."courses" course
			ON course.name->>'es' = v.course_name
		JOIN "academic"."academic_periods" period
			ON period.code = v.academic_period_code
		JOIN "evidence"."ifcs" ifc
			ON ifc.course_id = course.id AND ifc.academic_period_id = period.id
		JOIN "core"."types" status_type
			ON status_type.code = v.status_type_code
		JOIN "organization"."staff" staff
			ON staff.staff_email = v.staff_email
		WHERE NOT EXISTS (
			SELECT 1
			FROM "ifc"."statuses" status
			WHERE status.ifc_id = ifc.id
				AND status.status_type_id = status_type.id
				AND status.staff_id = staff.id
		);
	`);
});
