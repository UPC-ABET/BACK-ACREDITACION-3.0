import { runTenantSeed } from '../seed-runner';

runTenantSeed('evidence module', async (tenantDataSource) => {
	await tenantDataSource.query(`
		INSERT INTO "evidence"."instruments" (
			constituent_type_id,
			code,
			name,
			description,
			is_for_accreditation
		)
		SELECT constituent_type.id, v.code, v.name, v.description, v.is_for_accreditation
		FROM "core"."types" constituent_type
		JOIN (
			VALUES
				('TG501-T001', 'INST_FP_EXAM', 'Examen de Fundamentos de Programacion', 'Instrumento para medir solucion algoritmica basica', true),
				('TG501-T002', 'INST_CAPSTONE', 'Proyecto integrador de software', 'Instrumento para medir competencias integradas del programa', true),
				('TG501-T003', 'INST_SURVEY_STUDENT', 'Encuesta de percepcion estudiantil', 'Instrumento de percepcion para resultados del programa', false)
		) AS v(constituent_type_code, code, name, description, is_for_accreditation)
			ON constituent_type.code = v.constituent_type_code
		WHERE NOT EXISTS (
			SELECT 1 FROM "evidence"."instruments" instrument WHERE instrument.code = v.code
		);
	`);

	await tenantDataSource.query(`
		INSERT INTO "evidence"."ifcs" (study_plan_course_id, information)
		SELECT spc.id, v.information
		FROM (
			VALUES
				('SP_SOFT26', 'AP_2026_1', 'Fundamentos de Programacion', 'IFC para medir pensamiento critico y solucion tecnica en Fundamentos de Programacion.'),
				('SP_SOFT26', 'AP_2026_2', 'Proyecto Integrador de Software', 'IFC para medir colaboracion y solucion tecnica en Proyecto Integrador.')
		) AS v(study_plan_code, academic_period_code, course_name, information)
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
			FROM "evidence"."ifcs" ifc
			WHERE ifc.study_plan_course_id = spc.id AND ifc.information = v.information
		);
	`);

	await tenantDataSource.query(`
		INSERT INTO "evidence"."surveys" (
			survey_type_id,
			survey_status_type_id,
			student_id,
			academic_period_id,
			campus_id,
			program_id,
			information,
			survey_number,
			course_section_id
		)
		SELECT survey_type.id, survey_status.id, student.id, period.id, campus.id, program.id, v.information, v.survey_number, course_section.id
		FROM (
			VALUES
				('TG601-T001', 'TG602-T001', 'student.luis.ramirez@upc.edu.pe', 'AP_2026_1', 'CAMPUS_MON', 'PROG_SOFT', 'SOFT-FP-2026-1-A', 'Encuesta de satisfaccion del periodo 2026-1', 20260101),
				('TG601-T001', 'TG602-T001', 'student.sofia.torres@upc.edu.pe', 'AP_2026_1', 'CAMPUS_MON', 'PROG_SOFT', 'SOFT-FP-2026-1-A', 'Encuesta de satisfaccion del periodo 2026-1', 20260102)
		) AS v(survey_type_code, survey_status_code, student_email, academic_period_code, campus_code, program_code, section_code, information, survey_number)
		JOIN "core"."types" survey_type
			ON survey_type.code = v.survey_type_code
		JOIN "core"."types" survey_status
			ON survey_status.code = v.survey_status_code
		JOIN "organization"."users" user_entity
			ON user_entity.email = v.student_email
		JOIN "academic"."students" student
			ON student.user_id = user_entity.id
		JOIN "academic"."academic_periods" period
			ON period.code = v.academic_period_code
		JOIN "organization"."campuses" campus
			ON campus.code = v.campus_code
		JOIN "academic"."programs" program
			ON program.code = v.program_code
		JOIN "academic"."course_sections" course_section
			ON course_section.section_code = v.section_code
		WHERE NOT EXISTS (
			SELECT 1
			FROM "evidence"."surveys" survey
			WHERE survey.student_id = student.id AND survey.survey_number = v.survey_number
		);
	`);

	await tenantDataSource.query(`
		INSERT INTO "evidence"."student_course_outcome_grades" (
			student_section_enrollment_id,
			outcome_id,
			grade
		)
		SELECT sse.id, outcome.id, v.grade
		FROM (
			VALUES
				('student.luis.ramirez@upc.edu.pe', 'SOFT-FP-2026-1-A', 'OUT_SOFT_01', 16.500000),
				('student.luis.ramirez@upc.edu.pe', 'SOFT-FP-2026-1-A', 'OUT_SOFT_04', 17.000000),
				('student.sofia.torres@upc.edu.pe', 'SOFT-FP-2026-1-A', 'OUT_SOFT_01', 15.000000),
				('student.sofia.torres@upc.edu.pe', 'SOFT-FP-2026-1-A', 'OUT_SOFT_04', 16.000000)
		) AS v(student_email, section_code, outcome_code, grade)
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
		JOIN "accreditation"."outcomes" outcome
			ON outcome.outcome_code = v.outcome_code
		WHERE NOT EXISTS (
			SELECT 1
			FROM "evidence"."student_course_outcome_grades" scog
			WHERE scog.student_section_enrollment_id = sse.id AND scog.outcome_id = outcome.id
		);
	`);

	await tenantDataSource.query(`
		INSERT INTO "evidence"."evaluations" (
			project_student_id,
			project_evaluator_id,
			qualification_status_type_id,
			observation,
			register_at
		)
		SELECT project_student.id, project_evaluator.id, qualification_status.id, v.observation, v.register_at::timestamptz
		FROM (
			VALUES
				('PROJ_SOFT_FP_2026', 'student.luis.ramirez@upc.edu.pe', 'prof.juan.perez@upc.edu.pe', 'TG404-T002', 'Proyecto revisado con desempeno esperado alto.', '2026-06-10 10:00:00'),
				('PROJ_SOFT_FP_2026', 'student.sofia.torres@upc.edu.pe', 'prof.juan.perez@upc.edu.pe', 'TG404-T002', 'Proyecto revisado con desempeno esperado.', '2026-06-10 11:00:00')
		) AS v(project_code, student_email, professor_email, qualification_status_code, observation, register_at)
		JOIN "evaluation"."projects" project
			ON project.code = v.project_code
		JOIN "organization"."users" user_entity
			ON user_entity.email = v.student_email
		JOIN "academic"."students" student
			ON student.user_id = user_entity.id
		JOIN "academic"."enrolled_students" enrolled_student
			ON enrolled_student.student_id = student.id
		JOIN "academic"."student_section_enrollments" sse
			ON sse.enrolled_student_id = enrolled_student.id
		JOIN "evaluation"."project_students" project_student
			ON project_student.project_id = project.id AND project_student.student_section_enrollment_id = sse.id
		JOIN "organization"."staff" staff
			ON staff.staff_email = v.professor_email
		JOIN "academic"."professors" professor
			ON professor.staff_id = staff.id
		JOIN "evaluation"."project_evaluators" project_evaluator
			ON project_evaluator.project_id = project.id AND project_evaluator.professor_id = professor.id
		JOIN "core"."types" qualification_status
			ON qualification_status.code = v.qualification_status_code
		WHERE NOT EXISTS (
			SELECT 1
			FROM "evidence"."evaluations" evaluation
			WHERE evaluation.project_student_id = project_student.id
				AND evaluation.project_evaluator_id = project_evaluator.id
		);
	`);

	await tenantDataSource.query(`
		INSERT INTO "evaluation"."rubric_scores" (
			evaluation_id,
			rubric_outcome_criteria_id,
			rubric_question_criteria_id,
			score,
			commentaries
		)
		SELECT evaluation.id, roc.id, rqc.id, v.score, v.commentaries
		FROM (
			VALUES
				('PROJ_SOFT_FP_2026', 'student.luis.ramirez@upc.edu.pe', 'prof.juan.perez@upc.edu.pe', 'OUT_SOFT_01', 'Analiza el problema y define una solucion algoritmica coherente.', 'SCALE_FP_EXCELLENT', 18.000000, 'Analisis claro y completo.'),
				('PROJ_SOFT_FP_2026', 'student.luis.ramirez@upc.edu.pe', 'prof.juan.perez@upc.edu.pe', 'OUT_SOFT_04', 'Implementa la solucion con estructuras de control adecuadas.', 'SCALE_FP_EXPECTED', 16.000000, 'Implementacion correcta con oportunidades de mejora menores.'),
				('PROJ_SOFT_FP_2026', 'student.sofia.torres@upc.edu.pe', 'prof.juan.perez@upc.edu.pe', 'OUT_SOFT_01', 'Analiza el problema y define una solucion algoritmica coherente.', 'SCALE_FP_EXPECTED', 15.000000, 'Cubre los elementos principales del problema.')
		) AS v(project_code, student_email, professor_email, outcome_code, question, scale_code, score, commentaries)
		JOIN "evaluation"."projects" project
			ON project.code = v.project_code
		JOIN "organization"."users" user_entity
			ON user_entity.email = v.student_email
		JOIN "academic"."students" student
			ON student.user_id = user_entity.id
		JOIN "academic"."enrolled_students" enrolled_student
			ON enrolled_student.student_id = student.id
		JOIN "academic"."student_section_enrollments" sse
			ON sse.enrolled_student_id = enrolled_student.id
		JOIN "evaluation"."project_students" project_student
			ON project_student.project_id = project.id AND project_student.student_section_enrollment_id = sse.id
		JOIN "organization"."staff" staff
			ON staff.staff_email = v.professor_email
		JOIN "academic"."professors" professor
			ON professor.staff_id = staff.id
		JOIN "evaluation"."project_evaluators" project_evaluator
			ON project_evaluator.project_id = project.id AND project_evaluator.professor_id = professor.id
		JOIN "evidence"."evaluations" evaluation
			ON evaluation.project_student_id = project_student.id AND evaluation.project_evaluator_id = project_evaluator.id
		JOIN "accreditation"."outcomes" outcome
			ON outcome.outcome_code = v.outcome_code
		JOIN "evaluation"."rubric_questions" rq
			ON rq.outcome_id = outcome.id AND rq.question = v.question
		JOIN "evaluation"."rubric_outcome_criterias" roc
			ON roc.outcome_id = outcome.id AND roc.rubric_id = rq.rubric_id
		JOIN "evaluation"."rubric_scales" scale
			ON scale.code = v.scale_code
		JOIN "evaluation"."rubric_question_criterias" rqc
			ON rqc.rubric_question_id = rq.id AND rqc.rubric_scale_id = scale.id
		WHERE NOT EXISTS (
			SELECT 1
			FROM "evaluation"."rubric_scores" rs
			WHERE rs.evaluation_id = evaluation.id
				AND rs.rubric_outcome_criteria_id = roc.id
				AND rs.rubric_question_criteria_id = rqc.id
		);
	`);
});
