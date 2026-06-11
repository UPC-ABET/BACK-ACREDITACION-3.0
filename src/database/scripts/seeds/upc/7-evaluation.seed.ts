import { runTenantSeed, i18n } from '../seed-runner';

runTenantSeed('evaluation module', async (tenantDataSource) => {
	const projectValues = [
		[
			'PROJ_SOFT_FP_2026',
			i18n('Proyecto de Fundamentos de Programacion', 'Fundamentals of Programming project'),
			i18n(
				'Proyecto individual para evidenciar solucion algoritmica basica',
				'Individual project to evidence basic algorithmic solution',
			),
		],
		[
			'PROJ_SOFT_CAP_2026',
			i18n('Proyecto Integrador de Software', 'Software Integrator Project'),
			i18n(
				'Proyecto colaborativo integrador del programa',
				'Collaborative capstone project for the program',
			),
		],
	]
		.map(([code, name, description]) => `('${code}', '${name}'::jsonb, '${description}'::jsonb)`)
		.join(',\n\t\t\t');

	await tenantDataSource.query(`
		INSERT INTO "evaluation"."projects" (code, name, description)
		SELECT v.code, v.name, v.description
		FROM (
			VALUES
				${projectValues}
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
			student_section_enrollment_id
		)
		SELECT project.id, sse.id
		FROM (
			VALUES
				('PROJ_SOFT_FP_2026', 'student.luis.ramirez@upc.edu.pe', 'SOFT-FP-2026-1-A'),
				('PROJ_SOFT_FP_2026', 'student.sofia.torres@upc.edu.pe', 'SOFT-FP-2026-1-A')
		) AS v(project_code, student_email, section_code)
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
		WHERE NOT EXISTS (
			SELECT 1
			FROM "evaluation"."project_students" ps
			WHERE ps.project_id = project.id AND ps.student_section_enrollment_id = sse.id
		);
	`);

	await tenantDataSource.query(`
		INSERT INTO "evaluation"."rubrics" (
			rubric_type_id,
			grade_type_id,
			study_plan_course_id
		)
		SELECT rubric_type.id, grade_type.id, spc.id
		FROM (
			VALUES
				('TG401-T002', 'TG205-T006', 'SP_SOFT26', '202601', 'Fundamentos de Programacion'),
				('TG401-T001', 'TG205-T003', 'SP_SOFT26', '202502', 'Proyecto Integrador de Software')
		) AS v(rubric_type_code, grade_type_code, study_plan_code, academic_period_code, course_name)
		JOIN "core"."types" rubric_type
			ON rubric_type.code = v.rubric_type_code
		JOIN "core"."types" grade_type
			ON grade_type.code = v.grade_type_code
		JOIN "academic"."study_plans" sp
			ON sp.code = v.study_plan_code
		JOIN "academic"."study_plan_academic_periods" spap
			ON spap.study_plan_id = sp.id
		JOIN "academic"."academic_periods" ap
			ON ap.id = spap.academic_period_id AND ap.code = v.academic_period_code
		JOIN "academic"."courses" course
			ON course.name->>'es' = v.course_name
		JOIN "academic"."study_plan_courses" spc
			ON spc.study_plan_academic_period_id = spap.id AND spc.course_id = course.id
		WHERE NOT EXISTS (
			SELECT 1
			FROM "evaluation"."rubrics" rubric
			WHERE rubric.rubric_type_id = rubric_type.id
				AND rubric.grade_type_id = grade_type.id
				AND rubric.study_plan_course_id = spc.id
		);
	`);

	const rubricQuestionValues = [
		[
			'SP_SOFT26',
			'202601',
			'Fundamentos de Programacion',
			'OUT_SOFT_01',
			i18n(
				'Analiza el problema y define una solucion algoritmica coherente.',
				'Analyzes the problem and defines a coherent algorithmic solution.',
			),
		],
		[
			'SP_SOFT26',
			'202601',
			'Fundamentos de Programacion',
			'OUT_SOFT_04',
			i18n(
				'Implementa la solucion con estructuras de control adecuadas.',
				'Implements the solution with appropriate control structures.',
			),
		],
		[
			'SP_SOFT26',
			'202502',
			'Proyecto Integrador de Software',
			'OUT_SOFT_03',
			i18n(
				'Colabora de manera efectiva dentro del equipo de proyecto.',
				'Collaborates effectively within the project team.',
			),
		],
		[
			'SP_SOFT26',
			'202502',
			'Proyecto Integrador de Software',
			'OUT_SOFT_04',
			i18n(
				'Entrega una solucion de software verificable y mantenible.',
				'Delivers a verifiable and maintainable software solution.',
			),
		],
	]
		.map(([sp, ap, cn, oc, q]) => `('${sp}', '${ap}', '${cn}', '${oc}', '${q}'::jsonb)`)
		.join(',\n\t\t\t');

	await tenantDataSource.query(`
		INSERT INTO "evaluation"."rubric_questions" (rubric_id, outcome_id, question)
		SELECT rubric.id, outcome.id, v.question
		FROM (
			VALUES
				${rubricQuestionValues}
		) AS v(study_plan_code, academic_period_code, course_name, outcome_code, question)
		JOIN "academic"."study_plans" sp
			ON sp.code = v.study_plan_code
		JOIN "academic"."study_plan_academic_periods" spap
			ON spap.study_plan_id = sp.id
		JOIN "academic"."academic_periods" ap
			ON ap.id = spap.academic_period_id AND ap.code = v.academic_period_code
		JOIN "academic"."courses" course
			ON course.name->>'es' = v.course_name
		JOIN "academic"."study_plan_courses" spc
			ON spc.study_plan_academic_period_id = spap.id AND spc.course_id = course.id
		JOIN "evaluation"."rubrics" rubric
			ON rubric.study_plan_course_id = spc.id
		JOIN "accreditation"."outcomes" outcome
			ON outcome.outcome_code = v.outcome_code
		WHERE NOT EXISTS (
			SELECT 1
			FROM "evaluation"."rubric_questions" rq
			WHERE rq.rubric_id = rubric.id AND rq.outcome_id = outcome.id AND rq.question->>'es' = v.question->>'es'
		);
	`);

	const rubricQuestionCriteriaValues = [
		[
			'OUT_SOFT_01',
			i18n(
				'Analiza el problema y define una solucion algoritmica coherente.',
				'Analyzes the problem and defines a coherent algorithmic solution.',
			),
			i18n(
				'Identifica restricciones, entradas y salidas con precision.',
				'Identifies constraints, inputs and outputs accurately.',
			),
			17.0,
			20.0,
		],
		[
			'OUT_SOFT_01',
			i18n(
				'Analiza el problema y define una solucion algoritmica coherente.',
				'Analyzes the problem and defines a coherent algorithmic solution.',
			),
			i18n(
				'Cubre los elementos principales del problema.',
				'Covers the main elements of the problem.',
			),
			14.0,
			16.999999,
		],
		[
			'OUT_SOFT_01',
			i18n(
				'Analiza el problema y define una solucion algoritmica coherente.',
				'Analyzes the problem and defines a coherent algorithmic solution.',
			),
			i18n(
				'El analisis es incompleto o poco verificable.',
				'The analysis is incomplete or barely verifiable.',
			),
			0.0,
			13.999999,
		],
		[
			'OUT_SOFT_04',
			i18n(
				'Implementa la solucion con estructuras de control adecuadas.',
				'Implements the solution with appropriate control structures.',
			),
			i18n(
				'La implementacion es correcta, legible y prueba casos relevantes.',
				'The implementation is correct, readable and tests relevant cases.',
			),
			17.0,
			20.0,
		],
		[
			'OUT_SOFT_04',
			i18n(
				'Implementa la solucion con estructuras de control adecuadas.',
				'Implements the solution with appropriate control structures.',
			),
			i18n(
				'La implementacion resuelve el caso principal con claridad.',
				'The implementation solves the main case clearly.',
			),
			14.0,
			16.999999,
		],
		[
			'OUT_SOFT_04',
			i18n(
				'Implementa la solucion con estructuras de control adecuadas.',
				'Implements the solution with appropriate control structures.',
			),
			i18n(
				'La implementacion presenta errores importantes.',
				'The implementation has significant errors.',
			),
			0.0,
			13.999999,
		],
	]
		.map(
			([oc, q, c, min, max]) =>
				`('${oc}', '${q}'::jsonb, '${c}'::jsonb, ${(min as number).toFixed(6)}, ${(max as number).toFixed(6)})`,
		)
		.join(',\n\t\t\t');

	await tenantDataSource.query(`
		INSERT INTO "evaluation"."rubric_question_criterias" (
			rubric_question_id,
			criteria,
			min_value,
			max_value
		)
		SELECT rq.id, v.criteria, v.min_value, v.max_value
		FROM (
			VALUES
				${rubricQuestionCriteriaValues}
		) AS v(outcome_code, question, criteria, min_value, max_value)
		JOIN "accreditation"."outcomes" outcome
			ON outcome.outcome_code = v.outcome_code
		JOIN "evaluation"."rubric_questions" rq
			ON rq.outcome_id = outcome.id AND rq.question->>'es' = v.question->>'es'
		WHERE NOT EXISTS (
			SELECT 1
			FROM "evaluation"."rubric_question_criterias" rqc
			WHERE rqc.rubric_question_id = rq.id AND rqc.criteria->>'es' = v.criteria->>'es'
		);
	`);
});
