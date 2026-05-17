import { runTenantSeed, i18n } from '../seed-runner';

runTenantSeed('improvement module', async (tenantDataSource) => {
	const actionValues = [
		[
			i18n('Reforzar ejercicios de analisis algoritmico en Fundamentos de Programacion.', 'Reinforce algorithmic analysis exercises in Fundamentals of Programming.'),
			2026101,
			'PROG_SOFT',
			'AP_2026_1',
		],
		[i18n('Incorporar revisiones por pares en el Proyecto Integrador de Software.', 'Incorporate peer reviews into the Software Integrator Project.'), 2026102, 'PROG_SOFT', 'AP_2026_2'],
		[i18n('Actualizar la matriz de evidencias para indicadores de acreditacion.', 'Update the evidence matrix for accreditation indicators.'), 2026103, 'PROG_SOFT', 'AP_2026_1'],
		[i18n('Disenar bateria de ejercicios algoritmicos remediadores.', 'Design a remedial algorithmic exercise battery.'), 2025101, 'CS', '202502'],
		[i18n('Implementar revisiones por pares en laboratorios de CC101.', 'Implement peer reviews in CC101 labs.'), 2025102, 'CS', '202502'],
	]
		.map(([desc, corr, pc, apc]) => `('${desc}'::jsonb, ${corr}, '${pc}', '${apc}')`)
		.join(',\n\t\t\t');

	await tenantDataSource.query(`
		INSERT INTO "improvement"."actions" (
			description,
			correlative,
			program_id,
			academic_period_id
		)
		SELECT v.description, v.correlative, program.id, period.id
		FROM (
			VALUES
				${actionValues}
		) AS v(description, correlative, program_code, academic_period_code)
		JOIN "academic"."programs" program
			ON program.code = v.program_code
		JOIN "academic"."academic_periods" period
			ON period.code = v.academic_period_code
		WHERE NOT EXISTS (
			SELECT 1 FROM "improvement"."actions" action WHERE action.correlative = v.correlative
		);
	`);

	const findingValues = [
		[
			'TG801-T002',
			'INST_FP_EXAM',
			'calidad@upc.edu.pe',
			2026001,
			i18n('Se identifico necesidad de reforzar la formulacion de algoritmos antes de la implementacion.', 'Need identified to reinforce algorithm formulation before implementation.'),
			'Fundamentos de Programacion',
			'AP_2026_1',
			'CAMPUS_MON',
		],
		[
			'TG801-T001',
			'INST_CAPSTONE',
			'calidad@upc.edu.pe',
			2026002,
			i18n('Los equipos requieren mayor evidencia de colaboracion registrada durante el proyecto.', 'Teams require more recorded collaboration evidence during the project.'),
			'Proyecto Integrador de Software',
			'AP_2026_2',
			'CAMPUS_MON',
		],
		[
			'TG801-T001',
			'IFC',
			'coord.eiscb@upc.edu.pe',
			2025001,
			i18n('Brecha en evaluacion algoritmica detectada en el IFC de CC101.', 'Algorithmic-evaluation gap detected in CC101 IFC.'),
			'Algoritmos y Estructuras de Datos',
			'202502',
			'CAMPUS_SM',
		],
		[
			'TG801-T003',
			'IFC',
			'coord.eiscb@upc.edu.pe',
			2025002,
			i18n('Oportunidad de mejora en consultas SQL avanzadas reportada en el IFC de CC102.', 'Improvement opportunity in advanced SQL queries reported in CC102 IFC.'),
			'Bases de Datos',
			'202502',
			'CAMPUS_SM',
		],
	]
		.map(([ct, ic, em, corr, desc, cn, pc, cc]) => `('${ct}', '${ic}', '${em}', ${corr}, '${desc}'::jsonb, '${cn}', '${pc}', '${cc}')`)
		.join(',\n\t\t\t');

	await tenantDataSource.query(`
		INSERT INTO "improvement"."findings" (
			criticality_type_id,
			instrument_id,
			staff_id,
			correlative,
			description,
			course_id,
			academic_period_id,
			campus_id
		)
		SELECT criticality.id, instrument.id, staff.id, v.correlative, v.description, course.id, period.id, campus.id
		FROM (
			VALUES
				${findingValues}
		) AS v(criticality_type_code, instrument_code, staff_email, correlative, description, course_name, academic_period_code, campus_code)
		JOIN "core"."types" criticality
			ON criticality.code = v.criticality_type_code
		JOIN "evidence"."instruments" instrument
			ON instrument.code = v.instrument_code
		JOIN "organization"."staff" staff
			ON staff.staff_email = v.staff_email
		JOIN "academic"."courses" course
			ON course.name->>'es' = v.course_name
		JOIN "academic"."academic_periods" period
			ON period.code = v.academic_period_code
		JOIN "organization"."campuses" campus
			ON campus.code = v.campus_code
		WHERE NOT EXISTS (
			SELECT 1 FROM "improvement"."findings" finding WHERE finding.correlative = v.correlative
		);
	`);

	const findingActionValues = [
		[
			2026001,
			i18n('Reforzar ejercicios de analisis algoritmico en Fundamentos de Programacion.', 'Reinforce algorithmic analysis exercises in Fundamentals of Programming.'),
			true,
			'{"required":["syllabus","exercise-bank"]}',
		],
		[
			2026002,
			i18n('Incorporar revisiones por pares en el Proyecto Integrador de Software.', 'Incorporate peer reviews into the Software Integrator Project.'),
			true,
			'{"required":["peer-review-log","team-rubric"]}',
		],
		[2026001, i18n('Actualizar la matriz de evidencias para indicadores de acreditacion.', 'Update the evidence matrix for accreditation indicators.'), false, '{"required":["evidence-matrix"]}'],
		// CC101 finding (2025001) → 2 actions. First has evidences=NULL → derived PENDING; second has evidences set → derived IMPLEMENTED.
		[2025001, i18n('Disenar bateria de ejercicios algoritmicos remediadores.', 'Design a remedial algorithmic exercise battery.'), true, null],
		[2025001, i18n('Implementar revisiones por pares en laboratorios de CC101.', 'Implement peer reviews in CC101 labs.'), true, '{"x":1}'],
	]
		.map(([fc, desc, ipr, ev]) => `(${fc}, '${desc}'::jsonb, ${ipr}, ${ev === null ? 'NULL' : `'${ev}'::jsonb`})`)
		.join(',\n\t\t\t');

	await tenantDataSource.query(`
		INSERT INTO "improvement"."finding_actions" (
			finding_id,
			action_id,
			in_plan_required,
			evidences
		)
		SELECT finding.id, action.id, v.in_plan_required, v.evidences
		FROM (
			VALUES
				${findingActionValues}
		) AS v(finding_correlative, action_description, in_plan_required, evidences)
		JOIN "improvement"."findings" finding
			ON finding.correlative = v.finding_correlative
		JOIN "improvement"."actions" action
			ON action.description->>'es' = v.action_description->>'es'
		WHERE NOT EXISTS (
			SELECT 1
			FROM "improvement"."finding_actions" fa
			WHERE fa.finding_id = finding.id AND fa.action_id = action.id
		);
	`);

	const planValues = [
		[
			'PROG_SOFT',
			'AP_2026_1',
			i18n('Plan de mejora de evidencias 2026-1', '2026-1 evidence improvement plan'),
			i18n('Plan para cerrar brechas detectadas en evidencias de resultados de aprendizaje.', 'Plan to close gaps detected in learning outcome evidence.'),
			true,
		],
		[
			'PROG_SOFT',
			'AP_2026_2',
			i18n('Plan de seguimiento capstone 2026-2', '2026-2 capstone tracking plan'),
			i18n('Plan para fortalecer seguimiento de equipos en el proyecto integrador.', 'Plan to strengthen team tracking in the integrator project.'),
			true,
		],
	]
		.map(([pc, ap, name, desc, open]) => `('${pc}', '${ap}', '${name}'::jsonb, '${desc}'::jsonb, ${open as boolean})`)
		.join(',\n\t\t\t');

	await tenantDataSource.query(`
		INSERT INTO "improvement"."plans" (
			program_id,
			academic_period_id,
			name,
			description,
			is_open
		)
		SELECT program.id, period.id, v.name, v.description, v.is_open
		FROM (
			VALUES
				${planValues}
		) AS v(program_code, academic_period_code, name, description, is_open)
		JOIN "academic"."programs" program
			ON program.code = v.program_code
		JOIN "academic"."academic_periods" period
			ON period.code = v.academic_period_code
		WHERE NOT EXISTS (
			SELECT 1 FROM "improvement"."plans" plan WHERE plan.name->>'es' = v.name->>'es'
		);
	`);

	const planActionValues = [
		[
			i18n('Plan de mejora de evidencias 2026-1', '2026-1 evidence improvement plan'),
			2026001,
			i18n('Reforzar ejercicios de analisis algoritmico en Fundamentos de Programacion.', 'Reinforce algorithmic analysis exercises in Fundamentals of Programming.'),
		],
		[
			i18n('Plan de seguimiento capstone 2026-2', '2026-2 capstone tracking plan'),
			2026002,
			i18n('Incorporar revisiones por pares en el Proyecto Integrador de Software.', 'Incorporate peer reviews into the Software Integrator Project.'),
		],
	]
		.map(([planName, fc, actionDesc]) => `('${planName}'::jsonb, ${fc}, '${actionDesc}'::jsonb)`)
		.join(',\n\t\t\t');

	await tenantDataSource.query(`
		INSERT INTO "improvement"."plan_actions" (
			plan_id,
			finding_action_id
		)
		SELECT plan.id, finding_action.id
		FROM (
			VALUES
				${planActionValues}
		) AS v(plan_name, finding_correlative, action_description)
		JOIN "improvement"."plans" plan
			ON plan.name->>'es' = v.plan_name->>'es'
		JOIN "improvement"."findings" finding
			ON finding.correlative = v.finding_correlative
		JOIN "improvement"."actions" action
			ON action.description->>'es' = v.action_description->>'es'
		JOIN "improvement"."finding_actions" finding_action
			ON finding_action.finding_id = finding.id AND finding_action.action_id = action.id
		WHERE NOT EXISTS (
			SELECT 1
			FROM "improvement"."plan_actions" pa
			WHERE pa.plan_id = plan.id AND pa.finding_action_id = finding_action.id
		);
	`);

	await tenantDataSource.query(`
		INSERT INTO "improvement"."finding_outcomes" (finding_id, outcome_id)
		SELECT finding.id, outcome.id
		FROM (
			VALUES
				(2026001, 'OUT_SOFT_01'),
				(2026001, 'OUT_SOFT_04'),
				(2026002, 'OUT_SOFT_03'),
				(2025001, 'A1'),
				(2025001, 'A2'),
				(2025002, 'A1'),
				(2025002, 'A2')
		) AS v(finding_correlative, outcome_code)
		JOIN "improvement"."findings" finding
			ON finding.correlative = v.finding_correlative
		JOIN "accreditation"."outcomes" outcome
			ON outcome.outcome_code = v.outcome_code
		WHERE NOT EXISTS (
			SELECT 1
			FROM "improvement"."finding_outcomes" fo
			WHERE fo.finding_id = finding.id AND fo.outcome_id = outcome.id
		);
	`);

	await tenantDataSource.query(`
		INSERT INTO "ifc"."ifc_findings" (ifc_id, finding_id)
		SELECT ifc.id, finding.id
		FROM (
			VALUES
				('Fundamentos de Programacion', 'AP_2026_1', 2026001),
				('Proyecto Integrador de Software', 'AP_2026_2', 2026002),
				('Algoritmos y Estructuras de Datos', '202502', 2025001),
				('Bases de Datos', '202502', 2025002)
		) AS v(course_name, academic_period_code, finding_correlative)
		JOIN "academic"."courses" course
			ON course.name->>'es' = v.course_name
		JOIN "academic"."academic_periods" period
			ON period.code = v.academic_period_code
		JOIN "evidence"."ifcs" ifc
			ON ifc.course_id = course.id AND ifc.academic_period_id = period.id
		JOIN "improvement"."findings" finding
			ON finding.correlative = v.finding_correlative
		WHERE NOT EXISTS (
			SELECT 1
			FROM "ifc"."ifc_findings" ifc_finding
			WHERE ifc_finding.ifc_id = ifc.id AND ifc_finding.finding_id = finding.id
		);
	`);
});
