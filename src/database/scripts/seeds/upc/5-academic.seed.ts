import { runTenantSeed, i18n } from '../seed-runner';

runTenantSeed('academic module', async (tenantDataSource) => {
	await tenantDataSource.query(`
		INSERT INTO "academic"."academic_periods" ("modality_type_id", code, start_date, end_date)
		SELECT t.id, v.code, v.start_date::timestamptz, v.end_date::timestamptz
		FROM "core"."types" t
		JOIN (
			VALUES
				('TG102-T001', 'AP_2026_1', '2026-03-18', '2026-07-20'),
				('TG102-T001', 'AP_2026_2', '2026-08-17', '2026-12-18'),
				('TG102-T001', '202502', '2025-08-15', '2025-12-15'),
				-- 202601: a year-2026 period AFTER AP_2026_1 (Mar-Jul) so previous_actions
				-- can surface from AP_2026_1 in the same year.
				('TG102-T001', '202601', '2026-09-01', '2026-12-20')
		) AS v(modality_type_code, code, start_date, end_date)
			ON t.code = v.modality_type_code
		WHERE NOT EXISTS (
			SELECT 1 FROM "academic"."academic_periods" ap WHERE ap.code = v.code
		);
	`);

	const programValues = [
		[
			'TG102-T001',
			'PROG_SOFT',
			i18n('Ingenieria de Software', 'Software Engineering'),
			i18n('Bachiller', 'Bachelor'),
		],
		[
			'TG102-T001',
			'PROG_SIST',
			i18n('Ingenieria de Sistemas', 'Systems Engineering'),
			i18n('Bachiller', 'Bachelor'),
		],
		[
			'TG102-T001',
			'PROG_ADMIN',
			i18n('Administracion de Empresas', 'Business Administration'),
			i18n('Bachiller', 'Bachelor'),
		],
		[
			'TG102-T001',
			'CS',
			i18n('Ciencias de la Computacion', 'Computer Science'),
			i18n('Bachiller', 'Bachelor'),
		],
	]
		.map(
			([modality, code, name, degree]) =>
				`('${modality}', '${code}', '${name}'::jsonb, '${degree}'::jsonb)`,
		)
		.join(',\n\t\t\t');

	await tenantDataSource.query(`
		INSERT INTO "academic"."programs" (modality_type_id, code, name, degree)
		SELECT t.id, v.code, v.name, v.degree
		FROM "core"."types" t
		JOIN (
			VALUES
				${programValues}
		) AS v(modality_type_code, code, name, degree)
			ON t.code = v.modality_type_code
		WHERE NOT EXISTS (
			SELECT 1 FROM "academic"."programs" p WHERE p.code = v.code
		);
	`);

	await tenantDataSource.query(`
		INSERT INTO "academic"."students" (code, user_id, program_id, graduation_modality_type_id)
		SELECT v.code, u.id, p.id, t.id
		FROM "organization"."users" u
		JOIN (
			VALUES
				('STU-0001', 'student.luis.ramirez@upc.edu.pe', 'PROG_SOFT', 'TG202-T002'),
				('STU-0002', 'student.sofia.torres@upc.edu.pe', 'PROG_SOFT', 'TG202-T002')
		) AS v(code, email, program_code, graduation_type_code)
			ON u.email = v.email
		JOIN "academic"."programs" p
			ON p.code = v.program_code
		JOIN "core"."types" t
			ON t.code = v.graduation_type_code
		WHERE NOT EXISTS (
			SELECT 1 FROM "academic"."students" s WHERE s.user_id = u.id
		);
	`);

	const courseValues = [
		[
			'CRS_FUND_PROG',
			i18n('Fundamentos de Programacion', 'Fundamentals of Programming'),
			i18n(
				'Curso introductorio de programacion estructurada',
				'Introductory structured programming course',
			),
			i18n(
				'Construye soluciones basicas usando algoritmos y estructuras de control.',
				'Builds basic solutions using algorithms and control structures.',
			),
		],
		[
			'CRS_REQ_ENG',
			i18n('Ingenieria de Requisitos', 'Requirements Engineering'),
			i18n(
				'Curso de analisis y especificacion de requisitos',
				'Course on requirements analysis and specification',
			),
			i18n(
				'Elicita, documenta y valida requisitos de software con stakeholders.',
				'Elicits, documents and validates software requirements with stakeholders.',
			),
		],
		[
			'CRS_INT_PROJ',
			i18n('Proyecto Integrador de Software', 'Software Integrator Project'),
			i18n('Curso integrador basado en proyecto', 'Project-based capstone course'),
			i18n(
				'Integra competencias tecnicas, comunicacionales y de trabajo en equipo.',
				'Integrates technical, communication and teamwork competencies.',
			),
		],
		[
			'CC101',
			i18n('Algoritmos y Estructuras de Datos', 'Algorithms and Data Structures'),
			i18n('Curso base de algoritmica', 'Core algorithmics course'),
			i18n(
				'Disena algoritmos eficientes y estructuras de datos basicas.',
				'Designs efficient algorithms and basic data structures.',
			),
		],
		[
			'CC102',
			i18n('Bases de Datos', 'Databases'),
			i18n('Curso de modelado y consulta de datos', 'Data modeling and querying course'),
			i18n(
				'Modela y consulta bases de datos relacionales.',
				'Models and queries relational databases.',
			),
		],
		[
			'CC103',
			i18n('Ingenieria de Software', 'Software Engineering'),
			i18n('Curso de ciclo de vida de software', 'Software lifecycle course'),
			i18n(
				'Aplica procesos y practicas del ciclo de vida del software.',
				'Applies software lifecycle processes and practices.',
			),
		],
	]
		.map(
			([code, name, description, lo]) =>
				`('${code}', '${name}'::jsonb, '${description}'::jsonb, '${lo}'::jsonb)`,
		)
		.join(',\n\t\t\t');

	await tenantDataSource.query(`
		INSERT INTO "academic"."courses" (code, name, description, learning_outcome)
		SELECT v.code, v.name, v.description, v.learning_outcome
		FROM (
			VALUES
				${courseValues}
		) AS v(code, name, description, learning_outcome)
		WHERE NOT EXISTS (
			SELECT 1 FROM "academic"."courses" c WHERE c.code = v.code
		);
	`);

	const studyPlanValues = [
		[
			'PROG_SOFT',
			'SP_SOFT26',
			i18n('Plan 2026 Ingenieria de Software', '2026 Software Engineering Plan'),
			i18n(
				'Plan de estudios base para el programa de Ingenieria de Software',
				'Base study plan for the Software Engineering program',
			),
		],
		[
			'PROG_ADMIN',
			'SP_ADM26',
			i18n('Plan 2026 Administracion', '2026 Business Administration Plan'),
			i18n(
				'Plan de estudios base para Administracion de Empresas',
				'Base study plan for Business Administration',
			),
		],
		[
			'CS',
			'SP_CS_2502',
			i18n('Plan CS 2025-2', '2025-2 CS Plan'),
			i18n(
				'Plan de estudios para Ciencias de la Computacion (periodo 202502)',
				'Computer Science study plan (period 202502)',
			),
		],
	]
		.map(
			([programCode, code, name, description]) =>
				`('${programCode}', '${code}', '${name}'::jsonb, '${description}'::jsonb)`,
		)
		.join(',\n\t\t\t');

	await tenantDataSource.query(`
		INSERT INTO "academic"."study_plans" (program_id, code, name, description)
		SELECT p.id, v.code, v.name, v.description
		FROM "academic"."programs" p
		JOIN (
			VALUES
				${studyPlanValues}
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
				('SP_ADM26', 'AP_2026_1'),
				('SP_CS_2502', '202502'),
				('SP_CS_2502', '202601')
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
				('SP_SOFT26', 'AP_2026_2', 'Proyecto Integrador de Software', false, 'TG203-T003'),
				('SP_CS_2502', '202502', 'Algoritmos y Estructuras de Datos', false, 'TG203-T001'),
				('SP_CS_2502', '202502', 'Bases de Datos', false, 'TG203-T002'),
				('SP_CS_2502', '202502', 'Ingenieria de Software', false, 'TG203-T003'),
				-- Same three CS courses in 202601 so prefill/view IFC works there too.
				('SP_CS_2502', '202601', 'Algoritmos y Estructuras de Datos', false, 'TG203-T001'),
				('SP_CS_2502', '202601', 'Bases de Datos', false, 'TG203-T002'),
				('SP_CS_2502', '202601', 'Ingenieria de Software', false, 'TG203-T003')
		) AS v(study_plan_code, academic_period_code, course_name, is_elective, level_type_code)
			ON sp.code = v.study_plan_code AND ap.code = v.academic_period_code
		JOIN "academic"."courses" c
			ON c.name->>'es' = v.course_name
		JOIN "core"."types" t
			ON t.code = v.level_type_code
		WHERE NOT EXISTS (
			SELECT 1
			FROM "academic"."study_plan_courses" spc
			WHERE spc.study_plan_academic_period_id = spap.id AND spc.course_id = c.id
		);
	`);

	const professorRows: Array<[string, string]> = [
		['prof.juan.perez@upc.edu.pe', 'PROF-001'],
		['prof.maria.garcia@upc.edu.pe', 'PROF-002'],
		['coord.eiscb@upc.edu.pe', 'PROF-003'],
	];
	const professorValues = professorRows
		.map(([email, code]) => `('${email}', '${code}')`)
		.join(',\n\t\t\t');

	await tenantDataSource.query(`
		INSERT INTO "academic"."professors" (staff_id, code)
		SELECT s.id, v.code
		FROM (VALUES ${professorValues}) AS v(staff_email, code)
		JOIN "organization"."staff" s ON s.staff_email = v.staff_email
		WHERE NOT EXISTS (
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
			ON course.name->>'es' = v.course_name
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

	const performanceLevelValues = [
		['AP_2026_1', 'PL_EXCELLENT', i18n('Excelente', 'Excellent'), 4.0, 17.0, 20.0, 20.0],
		['AP_2026_1', 'PL_EXPECTED', i18n('Esperado', 'Expected'), 3.0, 14.0, 16.999999, 20.0],
		['AP_2026_1', 'PL_DEVELOPING', i18n('En desarrollo', 'Developing'), 2.0, 11.0, 13.999999, 20.0],
		['AP_2026_1', 'PL_STARTING', i18n('Inicial', 'Starting'), 1.0, 0.0, 10.999999, 20.0],
	]
		.map(
			([period, code, name, uv, min, max, maxv]) =>
				`('${period}', '${code}', '${name}'::jsonb, ${(uv as number).toFixed(6)}, ${(min as number).toFixed(6)}, ${(max as number).toFixed(6)}, ${(maxv as number).toFixed(6)})`,
		)
		.join(',\n\t\t\t');

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
				${performanceLevelValues}
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

	const chartValues = [
		[
			'calidad@upc.edu.pe',
			'AP_2026_1',
			1,
			0,
			i18n('Direccion de Calidad Academica', 'Academic Quality Office'),
			'TG903-T002',
			'PROG_SOFT',
		],
		[
			'prof.juan.perez@upc.edu.pe',
			'AP_2026_1',
			3,
			1,
			i18n('Coordinacion de Ingenieria de Software', 'Software Engineering Coordination'),
			'TG903-T001',
			'SCH_SOFT',
		],
	]
		.map(
			([email, period, lvl, root, title, etCode, ref]) =>
				`('${email}', '${period}', ${lvl}, ${root}, '${title}'::jsonb, '${etCode}', '${ref}')`,
		)
		.join(',\n\t\t\t');

	await tenantDataSource.query(`
		INSERT INTO "organization"."charts" (
			staff_id,
			academic_period_id,
			level_type_id,
			root_chart_id,
			title,
			entity_type_id,
			entity_code
		)
		SELECT
			staff.id,
			ap.id,
			level_type.id,
			v.root_chart_id,
			v.title,
			entity_type.id,
			CASE entity_type.code
				WHEN 'TG903-T001' THEN (SELECT id FROM "organization"."schools" WHERE code = v.entity_ref_code)
				WHEN 'TG903-T002' THEN (SELECT id FROM "academic"."programs"   WHERE code = v.entity_ref_code)
				WHEN 'TG903-T003' THEN (SELECT id FROM "academic"."courses"    WHERE code = v.entity_ref_code)
			END AS entity_code
		FROM (
			VALUES
				${chartValues}
		) AS v(staff_email, academic_period_code, chart_level_number, root_chart_id, title, entity_type_code, entity_ref_code)
		JOIN "organization"."staff" staff
			ON staff.staff_email = v.staff_email
		JOIN "academic"."academic_periods" ap
			ON ap.code = v.academic_period_code
		JOIN "core"."types" level_type
			ON (level_type.extra->>'level')::int = v.chart_level_number
			AND level_type.type_group_id = (SELECT id FROM "core"."type_groups" WHERE code = 'TG902')
		JOIN "core"."types" entity_type
			ON entity_type.code = v.entity_type_code
		WHERE NOT EXISTS (
			SELECT 1 FROM "organization"."charts" chart
			WHERE chart.academic_period_id = ap.id
			  AND chart.level_type_id      = level_type.id
			  AND chart.entity_type_id     = entity_type.id
		);
	`);

	// EISCB 6-level chart tree, parameterized by academic period code.
	// Chained inserts: each child's root_chart_id resolves to the parent row via subquery.
	const seedEiscbChartTree = async (periodCode: string) => {
		// Level 1 — Dean (school EISCB), no parent.
		await tenantDataSource.query(`
			INSERT INTO "organization"."charts" (
				staff_id, academic_period_id, level_type_id,
				root_chart_id, title, entity_type_id, entity_code
			)
			SELECT
				staff.id, ap.id, level_type.id, NULL,
				'${i18n('Decanato EISCB', "EISCB Dean's Office")}'::jsonb,
				NULL, NULL
			FROM "organization"."staff" staff
			JOIN "organization"."users" u           ON u.id = staff.user_id AND u.email = 'dean.eiscb@upc.edu.pe'
			JOIN "academic"."academic_periods" ap   ON ap.code = '${periodCode}'
			JOIN "core"."types" level_type          ON level_type.code = 'TG902-T001'
			WHERE NOT EXISTS (
				SELECT 1 FROM "organization"."charts" c
				WHERE c.academic_period_id = ap.id
				  AND c.level_type_id      = level_type.id
			);
		`);

		// Level 2 — School Director (school EISCB), parent = level 1 row.
		await tenantDataSource.query(`
			INSERT INTO "organization"."charts" (
				staff_id, academic_period_id, level_type_id,
				root_chart_id, title, entity_type_id, entity_code
			)
			SELECT
				staff.id, ap.id, level_type.id,
				(
					SELECT c.id FROM "organization"."charts" c
					JOIN "core"."types" pcl ON pcl.id = c.level_type_id
					WHERE c.academic_period_id = ap.id
					  AND (pcl.extra->>'level')::int =1
				),
				'${i18n('Direccion EISCB', 'EISCB School Direction')}'::jsonb,
				entity_type.id,
				(SELECT id FROM "organization"."schools" WHERE code = 'EISCB')
			FROM "organization"."staff" staff
			JOIN "organization"."users" u           ON u.id = staff.user_id AND u.email = 'director.eiscb@upc.edu.pe'
			JOIN "academic"."academic_periods" ap   ON ap.code = '${periodCode}'
			JOIN "core"."types" level_type          ON level_type.code = 'TG902-T002'
			JOIN "core"."types" entity_type         ON entity_type.code = 'TG903-T001'
			WHERE NOT EXISTS (
				SELECT 1 FROM "organization"."charts" c
				WHERE c.academic_period_id = ap.id
				  AND c.level_type_id      = level_type.id
				  AND c.entity_type_id     = entity_type.id
				  AND c.entity_code        = (SELECT id FROM "organization"."schools" WHERE code = 'EISCB')
			);
		`);

		// Level 3 — Program Coordinator (program CS), parent = level 2 row.
		await tenantDataSource.query(`
			INSERT INTO "organization"."charts" (
				staff_id, academic_period_id, level_type_id,
				root_chart_id, title, entity_type_id, entity_code
			)
			SELECT
				staff.id, ap.id, level_type.id,
				(
					SELECT c.id FROM "organization"."charts" c
					JOIN "core"."types" pcl ON pcl.id = c.level_type_id
					WHERE c.academic_period_id = ap.id
					  AND (pcl.extra->>'level')::int =2
					  AND c.entity_type_id     = (SELECT id FROM "core"."types" WHERE code = 'TG903-T001')
					  AND c.entity_code        = (SELECT id FROM "organization"."schools" WHERE code = 'EISCB')
				),
				'${i18n('Coordinacion de Programa CS', 'CS Program Coordination')}'::jsonb,
				entity_type.id,
				(SELECT id FROM "academic"."programs" WHERE code = 'CS')
			FROM "organization"."staff" staff
			JOIN "organization"."users" u           ON u.id = staff.user_id AND u.email = 'prog-coord.eiscb@upc.edu.pe'
			JOIN "academic"."academic_periods" ap   ON ap.code = '${periodCode}'
			JOIN "core"."types" level_type          ON level_type.code = 'TG902-T003'
			JOIN "core"."types" entity_type         ON entity_type.code = 'TG903-T002'
			WHERE NOT EXISTS (
				SELECT 1 FROM "organization"."charts" c
				WHERE c.academic_period_id = ap.id
				  AND c.level_type_id      = level_type.id
				  AND c.entity_type_id     = entity_type.id
				  AND c.entity_code        = (SELECT id FROM "academic"."programs" WHERE code = 'CS')
			);
		`);

		// Level 4 — Area Coordinator (role-only, no entity anchor), parent = level 3 row.
		await tenantDataSource.query(`
			INSERT INTO "organization"."charts" (
				staff_id, academic_period_id, level_type_id,
				root_chart_id, title, entity_type_id, entity_code
			)
			SELECT
				staff.id, ap.id, level_type.id,
				(
					SELECT c.id FROM "organization"."charts" c
					JOIN "core"."types" pcl ON pcl.id = c.level_type_id
					WHERE c.academic_period_id = ap.id
					  AND (pcl.extra->>'level')::int =3
					  AND c.entity_type_id     = (SELECT id FROM "core"."types" WHERE code = 'TG903-T002')
					  AND c.entity_code        = (SELECT id FROM "academic"."programs" WHERE code = 'CS')
				),
				'${i18n('Coordinacion de Area CS', 'CS Area Coordination')}'::jsonb,
				NULL, NULL
			FROM "organization"."staff" staff
			JOIN "organization"."users" u           ON u.id = staff.user_id AND u.email = 'area-coord.eiscb@upc.edu.pe'
			JOIN "academic"."academic_periods" ap   ON ap.code = '${periodCode}'
			JOIN "core"."types" level_type          ON level_type.code = 'TG902-T004'
			WHERE NOT EXISTS (
				SELECT 1 FROM "organization"."charts" c
				WHERE c.academic_period_id = ap.id
				  AND c.level_type_id      = level_type.id
			);
		`);

		// Level 5 — Subarea Coordinator (role-only, no entity anchor), parent = level 4 row.
		await tenantDataSource.query(`
			INSERT INTO "organization"."charts" (
				staff_id, academic_period_id, level_type_id,
				root_chart_id, title, entity_type_id, entity_code
			)
			SELECT
				staff.id, ap.id, level_type.id,
				(
					SELECT c.id FROM "organization"."charts" c
					JOIN "core"."types" pcl ON pcl.id = c.level_type_id
					WHERE c.academic_period_id = ap.id
					  AND (pcl.extra->>'level')::int =4
				),
				'${i18n('Coordinacion de Subarea CS', 'CS Subarea Coordination')}'::jsonb,
				NULL, NULL
			FROM "organization"."staff" staff
			JOIN "organization"."users" u           ON u.id = staff.user_id AND u.email = 'subarea-coord.eiscb@upc.edu.pe'
			JOIN "academic"."academic_periods" ap   ON ap.code = '${periodCode}'
			JOIN "core"."types" level_type          ON level_type.code = 'TG902-T005'
			WHERE NOT EXISTS (
				SELECT 1 FROM "organization"."charts" c
				WHERE c.academic_period_id = ap.id
				  AND c.level_type_id      = level_type.id
			);
		`);

		// Level 6 — Course Coordinators (CC101, CC102, CC103), all share level-5 parent.
		const courseChartValues = [
			['CC101', i18n('Coordinacion de Curso CC101', 'CC101 Course Coordination')],
			['CC102', i18n('Coordinacion de Curso CC102', 'CC102 Course Coordination')],
			['CC103', i18n('Coordinacion de Curso CC103', 'CC103 Course Coordination')],
		]
			.map(([code, title]) => `('${code}', '${title}'::jsonb)`)
			.join(',\n\t\t\t\t');

		await tenantDataSource.query(`
			INSERT INTO "organization"."charts" (
				staff_id, academic_period_id, level_type_id,
				root_chart_id, title, entity_type_id, entity_code
			)
			SELECT
				staff.id, ap.id, level_type.id,
				(
					SELECT c.id FROM "organization"."charts" c
					JOIN "core"."types" pcl ON pcl.id = c.level_type_id
					WHERE c.academic_period_id = ap.id
					  AND (pcl.extra->>'level')::int =5
				),
				v.title,
				entity_type.id,
				(SELECT id FROM "academic"."courses" WHERE code = v.course_code)
			FROM (
				VALUES
					${courseChartValues}
			) AS v(course_code, title)
			JOIN "organization"."staff" staff
				ON staff.id IS NOT NULL
			JOIN "organization"."users" u           ON u.id = staff.user_id AND u.email = 'coord.eiscb@upc.edu.pe'
			JOIN "academic"."academic_periods" ap   ON ap.code = '${periodCode}'
			JOIN "core"."types" level_type          ON level_type.code = 'TG902-T006'
			JOIN "core"."types" entity_type         ON entity_type.code = 'TG903-T003'
			WHERE NOT EXISTS (
				SELECT 1 FROM "organization"."charts" c
				WHERE c.academic_period_id = ap.id
				  AND c.level_type_id      = level_type.id
				  AND c.entity_type_id     = entity_type.id
				  AND c.entity_code        = (SELECT id FROM "academic"."courses" WHERE code = v.course_code)
			);
		`);
	};

	await seedEiscbChartTree('202502');
	await seedEiscbChartTree('202601');
});
