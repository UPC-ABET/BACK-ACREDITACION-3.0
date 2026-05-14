import { runTenantSeed } from '../seed-runner';

runTenantSeed('academic module', async (tenantDataSource) => {
	await tenantDataSource.query(`
		INSERT INTO "academic"."academic_periods" ("modality_type_Id", code, start_date, end_date)
		SELECT t.id, v.code, v.start_date::timestamptz, v.end_date::timestamptz
		FROM "core"."types" t
		JOIN (
			VALUES
				('TG103-T001', 'AP_2026_1', '2026-03-18', '2026-07-20'),
				('TG103-T001', 'AP_2026_2', '2026-08-17', '2026-12-18')
		) AS v(modality_type_code, code, start_date, end_date)
			ON t.code = v.modality_type_code
		WHERE NOT EXISTS (
			SELECT 1 FROM "academic"."academic_periods" ap WHERE ap.code = v.code
		);
	`);

	await tenantDataSource.query(`
		INSERT INTO "academic"."programs" (modality_type_id, code, name, degree)
		SELECT t.id, v.code, v.name, v.degree
		FROM "core"."types" t
		JOIN (
			VALUES
				('TG103-T001', 'PROG_SOFT', 'Ingenieria de Software', 'Bachiller'),
				('TG103-T001', 'PROG_SIST', 'Ingenieria de Sistemas', 'Bachiller'),
				('TG103-T002', 'PROG_ADMIN', 'Administracion de Empresas', 'Bachiller')
		) AS v(modality_type_code, code, name, degree)
			ON t.code = v.modality_type_code
		WHERE NOT EXISTS (
			SELECT 1 FROM "academic"."programs" p WHERE p.code = v.code
		);
	`);

	await tenantDataSource.query(`
		INSERT INTO "academic"."students" (user_id, program_id, graduation_modality_type_id)
		SELECT u.id, p.id, t.id
		FROM "organization"."users" u
		JOIN (
			VALUES
				('student.luis.ramirez@upc.edu.pe', 'PROG_SOFT', 'TG202-T002'),
				('student.sofia.torres@upc.edu.pe', 'PROG_SOFT', 'TG202-T002')
		) AS v(email, program_code, graduation_type_code)
			ON u.email = v.email
		JOIN "academic"."programs" p
			ON p.code = v.program_code
		JOIN "core"."types" t
			ON t.code = v.graduation_type_code
		WHERE NOT EXISTS (
			SELECT 1 FROM "academic"."students" s WHERE s.user_id = u.id
		);
	`);

	await tenantDataSource.query(`
		INSERT INTO "academic"."courses" (name, description, learning_outcome)
		SELECT v.name, v.description, v.learning_outcome
		FROM (
			VALUES
				('Fundamentos de Programacion', 'Curso introductorio de programacion estructurada', 'Construye soluciones basicas usando algoritmos y estructuras de control.'),
				('Ingenieria de Requisitos', 'Curso de analisis y especificacion de requisitos', 'Elicita, documenta y valida requisitos de software con stakeholders.'),
				('Proyecto Integrador de Software', 'Curso integrador basado en proyecto', 'Integra competencias tecnicas, comunicacionales y de trabajo en equipo.')
		) AS v(name, description, learning_outcome)
		WHERE NOT EXISTS (
			SELECT 1 FROM "academic"."courses" c WHERE c.name = v.name
		);
	`);

	await tenantDataSource.query(`
		INSERT INTO "academic"."study_plans" (program_id, code, name, description)
		SELECT p.id, v.code, v.name, v.description
		FROM "academic"."programs" p
		JOIN (
			VALUES
				('PROG_SOFT', 'SP_SOFT26', 'Plan 2026 Ingenieria de Software', 'Plan de estudios base para el programa de Ingenieria de Software'),
				('PROG_ADMIN', 'SP_ADM26', 'Plan 2026 Administracion', 'Plan de estudios base para Administracion de Empresas')
		) AS v(program_code, code, name, description)
			ON p.code = v.program_code
		WHERE NOT EXISTS (
			SELECT 1 FROM "academic"."study_plans" sp WHERE sp.code = v.code
		);
	`);

	await tenantDataSource.query(`
		INSERT INTO "academic"."study_plan_academic_periods" (study_plan_id, academic_period_id)
		SELECT sp.id, ap.id
		FROM "academic"."study_plans" sp
		JOIN (
			VALUES
				('SP_SOFT26', 'AP_2026_1'),
				('SP_SOFT26', 'AP_2026_2'),
				('SP_ADM26', 'AP_2026_1')
		) AS v(study_plan_code, academic_period_code)
			ON sp.code = v.study_plan_code
		JOIN "academic"."academic_periods" ap
			ON ap.code = v.academic_period_code
		WHERE NOT EXISTS (
			SELECT 1
			FROM "academic"."study_plan_academic_periods" spap
			WHERE spap.study_plan_id = sp.id AND spap.academic_period_id = ap.id
		);
	`);

	await tenantDataSource.query(`
		INSERT INTO "academic"."study_plan_courses" (
			study_plan_academic_period_id,
			course_id,
			is_elective,
			level_type_id
		)
		SELECT spap.id, c.id, v.is_elective, t.id
		FROM "academic"."study_plans" sp
		JOIN "academic"."study_plan_academic_periods" spap
			ON spap.study_plan_id = sp.id
		JOIN "academic"."academic_periods" ap
			ON ap.id = spap.academic_period_id
		JOIN (
			VALUES
				('SP_SOFT26', 'AP_2026_1', 'Fundamentos de Programacion', false, 'TG203-T001'),
				('SP_SOFT26', 'AP_2026_1', 'Ingenieria de Requisitos', false, 'TG203-T002'),
				('SP_SOFT26', 'AP_2026_2', 'Proyecto Integrador de Software', false, 'TG203-T003')
		) AS v(study_plan_code, academic_period_code, course_name, is_elective, level_type_code)
			ON sp.code = v.study_plan_code AND ap.code = v.academic_period_code
		JOIN "academic"."courses" c
			ON c.name = v.course_name
		JOIN "core"."types" t
			ON t.code = v.level_type_code
		WHERE NOT EXISTS (
			SELECT 1
			FROM "academic"."study_plan_courses" spc
			WHERE spc.study_plan_academic_period_id = spap.id AND spc.course_id = c.id
		);
	`);

	await tenantDataSource.query(`
		INSERT INTO "academic"."professors" (staff_id)
		SELECT s.id
		FROM "organization"."staff" s
		WHERE s.staff_email IN ('prof.juan.perez@upc.edu.pe', 'prof.maria.garcia@upc.edu.pe')
			AND NOT EXISTS (
				SELECT 1 FROM "academic"."professors" p WHERE p.staff_id = s.id
			);
	`);

	await tenantDataSource.query(`
		INSERT INTO "academic"."course_sections" (
			study_plan_course_id,
			campus_id,
			professor_id,
			section_code,
			schedule,
			section_modality_type_id
		)
		SELECT
			spc.id,
			campus.id,
			prof.id,
			v.section_code,
			v.schedule,
			modality.id
		FROM (
			VALUES
				('SP_SOFT26', 'AP_2026_1', 'Fundamentos de Programacion', 'SOFT-FP-2026-1-A', 'CAMPUS_MON', 'prof.juan.perez@upc.edu.pe', '{"days":["Monday","Wednesday"],"time":"09:00-11:00"}'::jsonb, 'TG204-T001'),
				('SP_SOFT26', 'AP_2026_1', 'Ingenieria de Requisitos', 'SOFT-REQ-2026-1-A', 'CAMPUS_MON', 'prof.maria.garcia@upc.edu.pe', '{"days":["Tuesday"],"time":"14:00-17:00"}'::jsonb, 'TG204-T001')
		) AS v(study_plan_code, academic_period_code, course_name, section_code, campus_code, professor_email, schedule, section_modality_type_code)
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
		JOIN "organization"."staff" staff
			ON staff.staff_email = v.professor_email
		JOIN "academic"."professors" prof
			ON prof.staff_id = staff.id
		JOIN "core"."types" modality
			ON modality.code = v.section_modality_type_code
		WHERE NOT EXISTS (
			SELECT 1 FROM "academic"."course_sections" cs WHERE cs.section_code = v.section_code
		);
	`);

	await tenantDataSource.query(`
		INSERT INTO "academic"."enrolled_students" (
			student_id,
			study_plan_academic_period,
			campus_id,
			enrollement_modality_type_id
		)
		SELECT st.id, spap.id, campus.id, modality.id
		FROM (
			VALUES
				('student.luis.ramirez@upc.edu.pe', 'SP_SOFT26', 'AP_2026_1', 'CAMPUS_MON', 'TG103-T001'),
				('student.sofia.torres@upc.edu.pe', 'SP_SOFT26', 'AP_2026_1', 'CAMPUS_MON', 'TG103-T001')
		) AS v(email, study_plan_code, academic_period_code, campus_code, modality_type_code)
		JOIN "organization"."users" u
			ON u.email = v.email
		JOIN "academic"."students" st
			ON st.user_id = u.id
		JOIN "academic"."study_plans" sp
			ON sp.code = v.study_plan_code
		JOIN "academic"."study_plan_academic_periods" spap
			ON spap.study_plan_id = sp.id
		JOIN "academic"."academic_periods" ap
			ON ap.id = spap.academic_period_id AND ap.code = v.academic_period_code
		JOIN "organization"."campuses" campus
			ON campus.code = v.campus_code
		JOIN "core"."types" modality
			ON modality.code = v.modality_type_code
		WHERE NOT EXISTS (
			SELECT 1
			FROM "academic"."enrolled_students" es
			WHERE es.student_id = st.id
				AND es.study_plan_academic_period = spap.id
				AND es.campus_id = campus.id
		);
	`);

	await tenantDataSource.query(`
		INSERT INTO "academic"."student_section_enrollments" (enrolled_student_id, course_section_id)
		SELECT es.id, cs.id
		FROM (
			VALUES
				('student.luis.ramirez@upc.edu.pe', 'SOFT-FP-2026-1-A'),
				('student.luis.ramirez@upc.edu.pe', 'SOFT-REQ-2026-1-A'),
				('student.sofia.torres@upc.edu.pe', 'SOFT-FP-2026-1-A'),
				('student.sofia.torres@upc.edu.pe', 'SOFT-REQ-2026-1-A')
		) AS v(email, section_code)
		JOIN "organization"."users" u
			ON u.email = v.email
		JOIN "academic"."students" st
			ON st.user_id = u.id
		JOIN "academic"."enrolled_students" es
			ON es.student_id = st.id
		JOIN "academic"."course_sections" cs
			ON cs.section_code = v.section_code
		WHERE NOT EXISTS (
			SELECT 1
			FROM "academic"."student_section_enrollments" sse
			WHERE sse.enrolled_student_id = es.id AND sse.course_section_id = cs.id
		);
	`);

	await tenantDataSource.query(`
		INSERT INTO "academic"."performance_levels" (
			instrument_type_id,
			academic_period_id,
			name,
			code,
			unique_value,
			min_score,
			max_score,
			max_value
		)
		SELECT instrument_type.id, ap.id, v.name, v.code, v.unique_value, v.min_score, v.max_score, v.max_value
		FROM "academic"."academic_periods" ap
		JOIN "core"."types" instrument_type
			ON instrument_type.code = 'TG206-T001'
		JOIN (
			VALUES
				('AP_2026_1', 'PL_EXCELLENT', 'Excelente', 4.000000, 17.000000, 20.000000, 20.000000),
				('AP_2026_1', 'PL_EXPECTED', 'Esperado', 3.000000, 14.000000, 16.999999, 20.000000),
				('AP_2026_1', 'PL_DEVELOPING', 'En desarrollo', 2.000000, 11.000000, 13.999999, 20.000000),
				('AP_2026_1', 'PL_STARTING', 'Inicial', 1.000000, 0.000000, 10.999999, 20.000000)
		) AS v(academic_period_code, code, name, unique_value, min_score, max_score, max_value)
			ON ap.code = v.academic_period_code
		WHERE NOT EXISTS (
			SELECT 1 FROM "academic"."performance_levels" pl WHERE pl.code = v.code
		);
	`);

	await tenantDataSource.query(`
		INSERT INTO "academic"."student_course_grades" (
			student_section_enrollment_id,
			grade_type_id,
			grade_type_percentage,
			grade
		)
		SELECT sse.id, grade_type.id, v.grade_type_percentage, v.grade
		FROM (
			VALUES
				('student.luis.ramirez@upc.edu.pe', 'SOFT-FP-2026-1-A', 'TG205-T001', 40.000000, 16.500000),
				('student.luis.ramirez@upc.edu.pe', 'SOFT-FP-2026-1-A', 'TG205-T002', 60.000000, 17.000000),
				('student.sofia.torres@upc.edu.pe', 'SOFT-FP-2026-1-A', 'TG205-T001', 40.000000, 15.000000),
				('student.sofia.torres@upc.edu.pe', 'SOFT-FP-2026-1-A', 'TG205-T002', 60.000000, 16.000000)
		) AS v(email, section_code, grade_type_code, grade_type_percentage, grade)
		JOIN "organization"."users" u
			ON u.email = v.email
		JOIN "academic"."students" st
			ON st.user_id = u.id
		JOIN "academic"."enrolled_students" es
			ON es.student_id = st.id
		JOIN "academic"."course_sections" cs
			ON cs.section_code = v.section_code
		JOIN "academic"."student_section_enrollments" sse
			ON sse.enrolled_student_id = es.id AND sse.course_section_id = cs.id
		JOIN "core"."types" grade_type
			ON grade_type.code = v.grade_type_code
		WHERE NOT EXISTS (
			SELECT 1
			FROM "academic"."student_course_grades" scg
			WHERE scg.student_section_enrollment_id = sse.id AND scg.grade_type_id = grade_type.id
		);
	`);

	await tenantDataSource.query(`
		INSERT INTO "organization"."charts" (
			staff_id,
			academic_period_id,
			chart_level_id,
			root_chart_detail_id,
			level_title,
			entity_type_id,
			entity_code
		)
		SELECT staff.id, ap.id, cl.id, v.root_chart_detail_id, v.level_title, entity_type.id, v.entity_code
		FROM (
			VALUES
				('calidad@upc.edu.pe', 'AP_2026_1', 1, 0, 'Direccion de Calidad Academica', 'TG903-T002', 'CHART_QUAL_2026'),
				('prof.juan.perez@upc.edu.pe', 'AP_2026_1', 3, 1, 'Coordinacion de Ingenieria de Software', 'TG903-T001', 'CHART_SOFT_2026')
		) AS v(staff_email, academic_period_code, chart_level_number, root_chart_detail_id, level_title, entity_type_code, entity_code)
		JOIN "organization"."staff" staff
			ON staff.staff_email = v.staff_email
		JOIN "academic"."academic_periods" ap
			ON ap.code = v.academic_period_code
		JOIN "organization"."chart_levels" cl
			ON cl.level = v.chart_level_number
		JOIN "core"."types" entity_type
			ON entity_type.code = v.entity_type_code
		WHERE NOT EXISTS (
			SELECT 1 FROM "organization"."charts" chart WHERE chart.entity_code = v.entity_code
		);
	`);
});
