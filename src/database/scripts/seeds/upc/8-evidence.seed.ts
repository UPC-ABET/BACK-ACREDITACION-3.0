import { runTenantSeed, i18n } from '../seed-runner';

runTenantSeed('evidence module', async (tenantDataSource) => {
	const instrumentValues = [
		[
			'TG501-T001',
			'INST_FP_EXAM',
			i18n('Examen de Fundamentos de Programacion', 'Fundamentals of Programming exam'),
			i18n('Instrumento para medir solucion algoritmica basica', 'Instrument to measure basic algorithmic solution'),
			true,
		],
		[
			'TG501-T002',
			'INST_CAPSTONE',
			i18n('Proyecto integrador de software', 'Software integrator project'),
			i18n('Instrumento para medir competencias integradas del programa', 'Instrument to measure integrated program competencies'),
			true,
		],
		[
			'TG501-T003',
			'INST_SURVEY_STUDENT',
			i18n('Encuesta de percepcion estudiantil', 'Student perception survey'),
			i18n('Instrumento de percepcion para resultados del programa', 'Perception instrument for program outcomes'),
			false,
		],
		['TG501-T001', 'INST_IFC', i18n('Informe Final del Curso', 'Course Final Report'), i18n('Instrumento IFC para reporte final del curso', 'Course final report (IFC) instrument'), true],
	]
		.map(([ctCode, code, name, desc, acc]) => `('${ctCode}', '${code}', '${name}'::jsonb, '${desc}'::jsonb, ${acc as boolean})`)
		.join(',\n\t\t\t');

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
				${instrumentValues}
		) AS v(constituent_type_code, code, name, description, is_for_accreditation)
			ON constituent_type.code = v.constituent_type_code
		WHERE NOT EXISTS (
			SELECT 1 FROM "evidence"."instruments" instrument WHERE instrument.code = v.code
		);
	`);

	const ifcValues = [
		[
			'Fundamentos de Programacion',
			'AP_2026_1',
			JSON.stringify({
				summary: {
					label: { es: 'Resumen IFC', en: 'IFC summary' },
					value: {
						es: 'IFC para medir pensamiento critico y solucion tecnica en Fundamentos de Programacion.',
						en: 'IFC measuring critical thinking and technical solution in Fundamentals of Programming.',
					},
					order: 1,
				},
			}),
		],
		[
			'Proyecto Integrador de Software',
			'AP_2026_2',
			JSON.stringify({
				summary: {
					label: { es: 'Resumen IFC', en: 'IFC summary' },
					value: {
						es: 'IFC para medir colaboracion y solucion tecnica en Proyecto Integrador.',
						en: 'IFC measuring collaboration and technical solution in the Integrator Project.',
					},
					order: 1,
				},
			}),
		],
		[
			'Algoritmos y Estructuras de Datos',
			'202502',
			JSON.stringify({
				infrastructure: {
					label: { es: 'Infraestructura', en: 'Infrastructure' },
					value: { es: 'Laboratorio con 30 PCs y proyector.', en: 'Lab with 30 PCs and a projector.' },
					order: 1,
				},
				methodology: {
					label: { es: 'Metodologia', en: 'Methodology' },
					value: { es: 'Aprendizaje basado en problemas.', en: 'Problem-based learning.' },
					order: 2,
				},
			}),
		],
		[
			'Bases de Datos',
			'202502',
			JSON.stringify({
				infrastructure: {
					label: { es: 'Infraestructura', en: 'Infrastructure' },
					value: { es: 'Servidor de base de datos compartido y entorno cloud.', en: 'Shared database server and cloud environment.' },
					order: 1,
				},
				methodology: {
					label: { es: 'Metodologia', en: 'Methodology' },
					value: { es: 'Casos practicos sobre datasets reales.', en: 'Case studies on real datasets.' },
					order: 2,
				},
			}),
		],
		// 202601 (year 2026): CC101 and CC102 get IFCs — useful for view/edit testing.
		// "Ingenieria de Software" (CC103) intentionally stays without an IFC for prefill testing.
		[
			'Algoritmos y Estructuras de Datos',
			'202601',
			JSON.stringify({
				infrastructure: {
					label: { es: 'Infraestructura', en: 'Infrastructure' },
					value: { es: 'Laboratorio renovado con 35 PCs y proyector 4K.', en: 'Refurbished lab with 35 PCs and 4K projector.' },
					order: 1,
				},
				methodology: {
					label: { es: 'Metodologia', en: 'Methodology' },
					value: { es: 'Aprendizaje basado en proyectos cortos.', en: 'Short-project-based learning.' },
					order: 2,
				},
			}),
		],
		[
			'Bases de Datos',
			'202601',
			JSON.stringify({
				infrastructure: {
					label: { es: 'Infraestructura', en: 'Infrastructure' },
					value: { es: 'Cluster managed PostgreSQL para practicas en aula.', en: 'Managed PostgreSQL cluster for classroom labs.' },
					order: 1,
				},
				methodology: {
					label: { es: 'Metodologia', en: 'Methodology' },
					value: { es: 'Talleres semanales con datasets institucionales.', en: 'Weekly workshops on institutional datasets.' },
					order: 2,
				},
			}),
		],
	]
		.map(([courseName, periodCode, info]) => `('${courseName}', '${periodCode}', '${(info as string).replace(/'/g, "''")}'::jsonb)`)
		.join(',\n\t\t\t');

	await tenantDataSource.query(`
		INSERT INTO "evidence"."ifcs" (course_id, academic_period_id, information)
		SELECT course.id, ap.id, v.information
		FROM (
			VALUES
				${ifcValues}
		) AS v(course_name, academic_period_code, information)
		JOIN "academic"."courses" course
			ON course.name->>'es' = v.course_name
		JOIN "academic"."academic_periods" ap
			ON ap.code = v.academic_period_code
		WHERE NOT EXISTS (
			SELECT 1
			FROM "evidence"."ifcs" ifc
			WHERE ifc.course_id = course.id AND ifc.academic_period_id = ap.id
		);
	`);

	const surveyValues = [
		[
			'TG601-T001',
			'TG602-T001',
			'student.luis.ramirez@upc.edu.pe',
			'AP_2026_1',
			'CAMPUS_MON',
			'PROG_SOFT',
			'SOFT-FP-2026-1-A',
			i18n('Encuesta de satisfaccion del periodo 2026-1', '2026-1 satisfaction survey'),
			20260101,
		],
		[
			'TG601-T001',
			'TG602-T001',
			'student.sofia.torres@upc.edu.pe',
			'AP_2026_1',
			'CAMPUS_MON',
			'PROG_SOFT',
			'SOFT-FP-2026-1-A',
			i18n('Encuesta de satisfaccion del periodo 2026-1', '2026-1 satisfaction survey'),
			20260102,
		],
	]
		.map(([st, ss, email, ap, c, pg, sc, info, num]) => `('${st}', '${ss}', '${email}', '${ap}', '${c}', '${pg}', '${sc}', '${info}'::jsonb, ${num})`)
		.join(',\n\t\t\t');

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
				${surveyValues}
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

	const evaluationValues = [
		[
			'PROJ_SOFT_FP_2026',
			'student.luis.ramirez@upc.edu.pe',
			'prof.juan.perez@upc.edu.pe',
			'TG404-T001',
			i18n('Proyecto revisado con desempeno esperado alto.', 'Project reviewed with high expected performance.'),
			'2026-06-10 10:00:00',
		],
		[
			'PROJ_SOFT_FP_2026',
			'student.sofia.torres@upc.edu.pe',
			'prof.juan.perez@upc.edu.pe',
			'TG404-T001',
			i18n('Proyecto revisado con desempeno esperado.', 'Project reviewed with expected performance.'),
			'2026-06-10 11:00:00',
		],
	]
		.map(([pc, se, pe, qs, obs, regAt]) => `('${pc}', '${se}', '${pe}', '${qs}', '${obs}'::jsonb, '${regAt}')`)
		.join(',\n\t\t\t');

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
				${evaluationValues}
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
	// NOTE: rubric_scores insert intentionally omitted in this seed.
	// rubric_scores requires rubric_outcome_criteria_id (NOT NULL), which is not
	// covered by this foundational spec. Re-add once that data flow is defined.
});
