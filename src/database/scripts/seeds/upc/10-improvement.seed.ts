import { runTenantSeed } from '../seed-runner';

runTenantSeed('improvement module', async (tenantDataSource) => {
	await tenantDataSource.query(`
		INSERT INTO "improvement"."actions" (description)
		SELECT v.description
		FROM (
			VALUES
				('Reforzar ejercicios de analisis algoritmico en Fundamentos de Programacion.'),
				('Incorporar revisiones por pares en el Proyecto Integrador de Software.'),
				('Actualizar la matriz de evidencias para indicadores de acreditacion.')
		) AS v(description)
		WHERE NOT EXISTS (
			SELECT 1 FROM "improvement"."actions" action WHERE action.description = v.description
		);
	`);

	await tenantDataSource.query(`
		INSERT INTO "improvement"."findings" (
			criticality_type_id,
			instrument_id,
			staff_id,
			correlative,
			description,
			study_plan_course_id,
			campus_id
		)
		SELECT criticality.id, instrument.id, staff.id, v.correlative, v.description, spc.id, campus.id
		FROM (
			VALUES
				('TG801-T002', 'INST_FP_EXAM', 'calidad@upc.edu.pe', 2026001, 'Se identifico necesidad de reforzar la formulacion de algoritmos antes de la implementacion.', 'SP_SOFT26', 'AP_2026_1', 'Fundamentos de Programacion', 'CAMPUS_MON'),
				('TG801-T001', 'INST_CAPSTONE', 'calidad@upc.edu.pe', 2026002, 'Los equipos requieren mayor evidencia de colaboracion registrada durante el proyecto.', 'SP_SOFT26', 'AP_2026_2', 'Proyecto Integrador de Software', 'CAMPUS_MON')
		) AS v(criticality_type_code, instrument_code, staff_email, correlative, description, study_plan_code, academic_period_code, course_name, campus_code)
		JOIN "core"."types" criticality
			ON criticality.code = v.criticality_type_code
		JOIN "evidence"."instruments" instrument
			ON instrument.code = v.instrument_code
		JOIN "organization"."staff" staff
			ON staff.staff_email = v.staff_email
		JOIN "academic"."study_plans" sp
			ON sp.code = v.study_plan_code
		JOIN "academic"."study_plan_academic_periods" spap
			ON spap.study_plan_id = sp.id
		JOIN "academic"."academic_periods" ap
			ON ap.id = spap.academic_period_id AND ap.code = v.academic_period_code
		JOIN "academic"."courses" course
			ON course.name = v.course_name
		JOIN "academic"."study_plan_courses" spc
			ON spc.study_plan_academic_period_id = spap.id AND spc.course_id = course.id
		JOIN "organization"."campuses" campus
			ON campus.code = v.campus_code
		WHERE NOT EXISTS (
			SELECT 1 FROM "improvement"."findings" finding WHERE finding.correlative = v.correlative
		);
	`);

	await tenantDataSource.query(`
		INSERT INTO "improvement"."finding_actions" (
			finding_id,
			action_id,
			in_plan_required
		)
		SELECT finding.id, action.id, v.in_plan_required
		FROM (
			VALUES
				(2026001, 'Reforzar ejercicios de analisis algoritmico en Fundamentos de Programacion.', true),
				(2026002, 'Incorporar revisiones por pares en el Proyecto Integrador de Software.', true),
				(2026001, 'Actualizar la matriz de evidencias para indicadores de acreditacion.', false)
		) AS v(finding_correlative, action_description, in_plan_required)
		JOIN "improvement"."findings" finding
			ON finding.correlative = v.finding_correlative
		JOIN "improvement"."actions" action
			ON action.description = v.action_description
		WHERE NOT EXISTS (
			SELECT 1
			FROM "improvement"."finding_actions" fa
			WHERE fa.finding_id = finding.id AND fa.action_id = action.id
		);
	`);

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
				('PROG_SOFT', 'AP_2026_1', 'Plan de mejora de evidencias 2026-1', 'Plan para cerrar brechas detectadas en evidencias de resultados de aprendizaje.', true),
				('PROG_SOFT', 'AP_2026_2', 'Plan de seguimiento capstone 2026-2', 'Plan para fortalecer seguimiento de equipos en el proyecto integrador.', true)
		) AS v(program_code, academic_period_code, name, description, is_open)
		JOIN "academic"."programs" program
			ON program.code = v.program_code
		JOIN "academic"."academic_periods" period
			ON period.code = v.academic_period_code
		WHERE NOT EXISTS (
			SELECT 1 FROM "improvement"."plans" plan WHERE plan.name = v.name
		);
	`);

	await tenantDataSource.query(`
		INSERT INTO "improvement"."plan_actions" (
			plan_id,
			finding_action_id,
			evidences
		)
		SELECT plan.id, finding_action.id, v.evidences
		FROM (
			VALUES
				('Plan de mejora de evidencias 2026-1', 2026001, 'Reforzar ejercicios de analisis algoritmico en Fundamentos de Programacion.', '{"required":["syllabus","exercise-bank"]}'::jsonb),
				('Plan de seguimiento capstone 2026-2', 2026002, 'Incorporar revisiones por pares en el Proyecto Integrador de Software.', '{"required":["peer-review-log","team-rubric"]}'::jsonb)
		) AS v(plan_name, finding_correlative, action_description, evidences)
		JOIN "improvement"."plans" plan
			ON plan.name = v.plan_name
		JOIN "improvement"."findings" finding
			ON finding.correlative = v.finding_correlative
		JOIN "improvement"."actions" action
			ON action.description = v.action_description
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
				(2026002, 'OUT_SOFT_03')
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
				('IFC para medir pensamiento critico y solucion tecnica en Fundamentos de Programacion.', 2026001),
				('IFC para medir colaboracion y solucion tecnica en Proyecto Integrador.', 2026002)
		) AS v(ifc_information, finding_correlative)
		JOIN "evidence"."ifcs" ifc
			ON ifc.information = v.ifc_information
		JOIN "improvement"."findings" finding
			ON finding.correlative = v.finding_correlative
		WHERE NOT EXISTS (
			SELECT 1
			FROM "ifc"."ifc_findings" ifc_finding
			WHERE ifc_finding.ifc_id = ifc.id AND ifc_finding.finding_id = finding.id
		);
	`);
});
