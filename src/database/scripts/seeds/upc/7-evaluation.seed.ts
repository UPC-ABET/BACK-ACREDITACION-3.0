import { runTenantSeed } from '../seed-runner';

runTenantSeed('evaluation module', async (tenantDataSource) => {
	await tenantDataSource.query(`
		INSERT INTO "evaluation"."projects" (code, name, description)
		SELECT v.code, v.name, v.description
		FROM (
			VALUES
				('PROJ_SOFT_FP_2026', 'Proyecto de Fundamentos de Programacion', 'Proyecto individual para evidenciar solucion algoritmica basica'),
				('PROJ_SOFT_CAP_2026', 'Proyecto Integrador de Software', 'Proyecto colaborativo integrador del programa')
		) AS v(code, name, description)
		WHERE NOT EXISTS (
			SELECT 1 FROM "evaluation"."projects" p WHERE p.code = v.code
		);
	`);

	await tenantDataSource.query(`
		INSERT INTO "evaluation"."project_evaluators" (project_id, professor_id, evaluator_type_id)
		SELECT project.id, professor.id, evaluator_type.id
		FROM (
			VALUES
				('PROJ_SOFT_FP_2026', 'prof.juan.perez@upc.edu.pe', 'TG403-T001'),
				('PROJ_SOFT_CAP_2026', 'prof.maria.garcia@upc.edu.pe', 'TG403-T001')
		) AS v(project_code, professor_email, evaluator_type_code)
		JOIN "evaluation"."projects" project
			ON project.code = v.project_code
		JOIN "organization"."staff" staff
			ON staff.staff_email = v.professor_email
		JOIN "academic"."professors" professor
			ON professor.staff_id = staff.id
		JOIN "core"."types" evaluator_type
			ON evaluator_type.code = v.evaluator_type_code
		WHERE NOT EXISTS (
			SELECT 1
			FROM "evaluation"."project_evaluators" pe
			WHERE pe.project_id = project.id AND pe.professor_id = professor.id
		);
	`);

	await tenantDataSource.query(`
		INSERT INTO "evaluation"."project_students" (
			project_id,
			student_section_enrollment_id,
			evaluator_type_id
		)
		SELECT project.id, sse.id, evaluator_type.id
		FROM (
			VALUES
				('PROJ_SOFT_FP_2026', 'student.luis.ramirez@upc.edu.pe', 'SOFT-FP-2026-1-A', 'TG403-T002'),
				('PROJ_SOFT_FP_2026', 'student.sofia.torres@upc.edu.pe', 'SOFT-FP-2026-1-A', 'TG403-T002')
		) AS v(project_code, student_email, section_code, evaluator_type_code)
		JOIN "evaluation"."projects" project
			ON project.code = v.project_code
		JOIN "organization"."users" user_entity
			ON user_entity.email = v.student_email
		JOIN "academic"."students" student
			ON student.user_id = user_entity.id
		JOIN "academic"."enrolled_students" enrolled_student
			ON enrolled_student.student_id = student.id
		JOIN "academic"."course_sections" course_section
			ON course_section.section_code = v.section_code
		JOIN "academic"."student_section_enrollments" sse
			ON sse.enrolled_student_id = enrolled_student.id AND sse.course_section_id = course_section.id
		JOIN "core"."types" evaluator_type
			ON evaluator_type.code = v.evaluator_type_code
		WHERE NOT EXISTS (
			SELECT 1
			FROM "evaluation"."project_students" ps
			WHERE ps.project_id = project.id AND ps.student_section_enrollment_id = sse.id
		);
	`);

	await tenantDataSource.query(`
		INSERT INTO "evaluation"."rubrics" (
			rubric_type_id,
			segment_type_id,
			study_plan_course_id
		)
		SELECT rubric_type.id, segment_type.id, spc.id
		FROM (
			VALUES
				('TG401-T002', 'TG402-T001', 'SP_SOFT26', 'AP_2026_1', 'Fundamentos de Programacion'),
				('TG401-T001', 'TG402-T001', 'SP_SOFT26', 'AP_2026_2', 'Proyecto Integrador de Software')
		) AS v(rubric_type_code, segment_type_code, study_plan_code, academic_period_code, course_name)
		JOIN "core"."types" rubric_type
			ON rubric_type.code = v.rubric_type_code
		JOIN "core"."types" segment_type
			ON segment_type.code = v.segment_type_code
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
		WHERE NOT EXISTS (
			SELECT 1
			FROM "evaluation"."rubrics" rubric
			WHERE rubric.rubric_type_id = rubric_type.id
				AND rubric.segment_type_id = segment_type.id
				AND rubric.study_plan_course_id = spc.id
		);
	`);

	await tenantDataSource.query(`
		INSERT INTO "evaluation"."rubric_scales" (rubric_id, code, name)
		SELECT rubric.id, v.code, v.name
		FROM (
			VALUES
				('SP_SOFT26', 'AP_2026_1', 'Fundamentos de Programacion', 'SCALE_FP_EXCELLENT', 'Excelente'),
				('SP_SOFT26', 'AP_2026_1', 'Fundamentos de Programacion', 'SCALE_FP_EXPECTED', 'Esperado'),
				('SP_SOFT26', 'AP_2026_1', 'Fundamentos de Programacion', 'SCALE_FP_STARTING', 'Inicial'),
				('SP_SOFT26', 'AP_2026_2', 'Proyecto Integrador de Software', 'SCALE_CAP_EXCELLENT', 'Excelente'),
				('SP_SOFT26', 'AP_2026_2', 'Proyecto Integrador de Software', 'SCALE_CAP_EXPECTED', 'Esperado'),
				('SP_SOFT26', 'AP_2026_2', 'Proyecto Integrador de Software', 'SCALE_CAP_STARTING', 'Inicial')
		) AS v(study_plan_code, academic_period_code, course_name, code, name)
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
		JOIN "evaluation"."rubrics" rubric
			ON rubric.study_plan_course_id = spc.id
		WHERE NOT EXISTS (
			SELECT 1 FROM "evaluation"."rubric_scales" scale WHERE scale.code = v.code
		);
	`);

	await tenantDataSource.query(`
		INSERT INTO "evaluation"."rubric_questions" (rubric_id, outcome_id, question)
		SELECT rubric.id, outcome.id, v.question
		FROM (
			VALUES
				('SP_SOFT26', 'AP_2026_1', 'Fundamentos de Programacion', 'OUT_SOFT_01', 'Analiza el problema y define una solucion algoritmica coherente.'),
				('SP_SOFT26', 'AP_2026_1', 'Fundamentos de Programacion', 'OUT_SOFT_04', 'Implementa la solucion con estructuras de control adecuadas.'),
				('SP_SOFT26', 'AP_2026_2', 'Proyecto Integrador de Software', 'OUT_SOFT_03', 'Colabora de manera efectiva dentro del equipo de proyecto.'),
				('SP_SOFT26', 'AP_2026_2', 'Proyecto Integrador de Software', 'OUT_SOFT_04', 'Entrega una solucion de software verificable y mantenible.')
		) AS v(study_plan_code, academic_period_code, course_name, outcome_code, question)
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
		JOIN "evaluation"."rubrics" rubric
			ON rubric.study_plan_course_id = spc.id
		JOIN "accreditation"."outcomes" outcome
			ON outcome.outcome_code = v.outcome_code
		WHERE NOT EXISTS (
			SELECT 1
			FROM "evaluation"."rubric_questions" rq
			WHERE rq.rubric_id = rubric.id AND rq.outcome_id = outcome.id AND rq.question = v.question
		);
	`);

	await tenantDataSource.query(`
		INSERT INTO "evaluation"."rubric_question_criterias" (
			rubric_question_id,
			rubric_scale_id,
			criteria,
			min_value,
			max_value
		)
		SELECT rq.id, scale.id, v.criteria, v.min_value, v.max_value
		FROM (
			VALUES
				('OUT_SOFT_01', 'Analiza el problema y define una solucion algoritmica coherente.', 'SCALE_FP_EXCELLENT', 'El analisis identifica restricciones, entradas y salidas con precision.', 17.000000, 20.000000),
				('OUT_SOFT_01', 'Analiza el problema y define una solucion algoritmica coherente.', 'SCALE_FP_EXPECTED', 'El analisis cubre los elementos principales del problema.', 14.000000, 16.999999),
				('OUT_SOFT_01', 'Analiza el problema y define una solucion algoritmica coherente.', 'SCALE_FP_STARTING', 'El analisis es incompleto o poco verificable.', 0.000000, 13.999999),
				('OUT_SOFT_04', 'Implementa la solucion con estructuras de control adecuadas.', 'SCALE_FP_EXCELLENT', 'La implementacion es correcta, legible y prueba casos relevantes.', 17.000000, 20.000000),
				('OUT_SOFT_04', 'Implementa la solucion con estructuras de control adecuadas.', 'SCALE_FP_EXPECTED', 'La implementacion resuelve el caso principal con claridad.', 14.000000, 16.999999),
				('OUT_SOFT_04', 'Implementa la solucion con estructuras de control adecuadas.', 'SCALE_FP_STARTING', 'La implementacion presenta errores importantes.', 0.000000, 13.999999)
		) AS v(outcome_code, question, scale_code, criteria, min_value, max_value)
		JOIN "accreditation"."outcomes" outcome
			ON outcome.outcome_code = v.outcome_code
		JOIN "evaluation"."rubric_questions" rq
			ON rq.outcome_id = outcome.id AND rq.question = v.question
		JOIN "evaluation"."rubric_scales" scale
			ON scale.code = v.scale_code
		WHERE NOT EXISTS (
			SELECT 1
			FROM "evaluation"."rubric_question_criterias" rqc
			WHERE rqc.rubric_question_id = rq.id AND rqc.rubric_scale_id = scale.id
		);
	`);

	await tenantDataSource.query(`
		INSERT INTO "evaluation"."rubric_outcome_criterias" (rubric_id, outcome_id, criteria)
		SELECT rubric.id, outcome.id, v.criteria
		FROM (
			VALUES
				('SP_SOFT26', 'AP_2026_1', 'Fundamentos de Programacion', 'OUT_SOFT_01', 'La evidencia permite valorar pensamiento critico en solucion de problemas.'),
				('SP_SOFT26', 'AP_2026_1', 'Fundamentos de Programacion', 'OUT_SOFT_04', 'La evidencia permite valorar solucion tecnica implementada.'),
				('SP_SOFT26', 'AP_2026_2', 'Proyecto Integrador de Software', 'OUT_SOFT_03', 'La evidencia permite valorar colaboracion efectiva.'),
				('SP_SOFT26', 'AP_2026_2', 'Proyecto Integrador de Software', 'OUT_SOFT_04', 'La evidencia permite valorar calidad tecnica del producto.')
		) AS v(study_plan_code, academic_period_code, course_name, outcome_code, criteria)
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
		JOIN "evaluation"."rubrics" rubric
			ON rubric.study_plan_course_id = spc.id
		JOIN "accreditation"."outcomes" outcome
			ON outcome.outcome_code = v.outcome_code
		WHERE NOT EXISTS (
			SELECT 1
			FROM "evaluation"."rubric_outcome_criterias" roc
			WHERE roc.rubric_id = rubric.id AND roc.outcome_id = outcome.id
		);
	`);
});
