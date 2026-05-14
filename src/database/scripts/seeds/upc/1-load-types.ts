import { runTenantSeed } from '../seed-runner';

runTenantSeed('core type catalogs', async (tenantDataSource) => {
	await tenantDataSource.query(`
		INSERT INTO "core"."type_groups" (code, name, description)
		SELECT v.code, v.name, v.description
		FROM (
			VALUES
				('TG101', 'Tipo de documento', 'Documentos y valores base para usuarios'),
				('TG103', 'Modalidad de ensenanza', 'Modalidades academicas generales'),
				('TG202', 'Modalidad de graduacion', 'Modalidades de egreso del estudiante'),
				('TG203', 'Nivel academico', 'Niveles de cursos en el plan de estudios'),
				('TG204', 'Modalidad de seccion', 'Modalidades para secciones academicas'),
				('TG205', 'Tipo de nota', 'Tipos de evaluacion calificada'),
				('TG206', 'Tipo de instrumento de desempeno', 'Tipos para niveles de desempeno'),
				('TG301', 'Tipo de comision', 'Tipos de comision de acreditacion'),
				('TG302', 'Tipo de resultado', 'Tipos de resultados de aprendizaje'),
				('TG401', 'Tipo de rubrica', 'Tipos de rubricas de evaluacion'),
				('TG402', 'Tipo de segmento', 'Segmentos para rubricas'),
				('TG403', 'Tipo de evaluador', 'Roles de evaluadores y participantes'),
				('TG404', 'Estado de calificacion', 'Estados de evaluaciones calificadas'),
				('TG501', 'Tipo constituyente', 'Tipos de instrumentos de evidencia'),
				('TG601', 'Tipo de encuesta', 'Tipos de encuestas'),
				('TG602', 'Estado de encuesta', 'Estados de encuestas'),
				('TG701', 'Estado IFC', 'Estados de indicadores IFC'),
				('TG801', 'Criticidad de hallazgo', 'Niveles de criticidad'),
				('TG901', 'Cargo del personal', 'Tipos de cargos administrativos y docentes'),
				('TG902', 'Nivel de organigrama', 'Niveles de estructura organizacional'),
				('TG903', 'Tipo de entidad organizacional', 'Tipos de entidades en organigrama'),
				('TG1001', 'Estado de notificacion', 'Estados de notificaciones')
		) AS v(code, name, description)
		WHERE NOT EXISTS (
			SELECT 1 FROM "core"."type_groups" tg WHERE tg.code = v.code
		);
	`);

	await tenantDataSource.query(`
		INSERT INTO "core"."types" (type_group_id, code, name, description, extra, is_active)
		SELECT tg.id, v.code, v.name, v.description, v.extra, true
		FROM "core"."type_groups" tg
		JOIN (
			VALUES
				('TG101', 'TG101-T001', 'DNI', 'Documento Nacional de Identidad', '{}'::jsonb),
				('TG101', 'TG101-T002', 'Pasaporte', 'Pasaporte internacional', '{}'::jsonb),
				('TG101', 'TG101-T003', 'Carne de extranjeria', 'Carne de extranjeria', '{}'::jsonb),
				('TG103', 'TG103-T001', 'Presencial', 'Educacion presencial', '{"mode":"in-person"}'::jsonb),
				('TG103', 'TG103-T002', 'Virtual', 'Educacion virtual', '{"mode":"online"}'::jsonb),
				('TG103', 'TG103-T003', 'Hibrida', 'Educacion hibrida', '{"mode":"hybrid"}'::jsonb),
				('TG202', 'TG202-T001', 'Tesis', 'Graduacion por tesis', '{}'::jsonb),
				('TG202', 'TG202-T002', 'Proyecto profesional', 'Graduacion por proyecto profesional', '{}'::jsonb),
				('TG203', 'TG203-T001', 'Primer ciclo', 'Curso de primer ciclo', '{"level":1}'::jsonb),
				('TG203', 'TG203-T002', 'Segundo ciclo', 'Curso de segundo ciclo', '{"level":2}'::jsonb),
				('TG203', 'TG203-T003', 'Tercer ciclo', 'Curso de tercer ciclo', '{"level":3}'::jsonb),
				('TG204', 'TG204-T001', 'Seccion presencial', 'Seccion dictada presencialmente', '{}'::jsonb),
				('TG204', 'TG204-T002', 'Seccion virtual', 'Seccion dictada virtualmente', '{}'::jsonb),
				('TG205', 'TG205-T001', 'Parcial', 'Evaluacion parcial', '{"weight":0.4}'::jsonb),
				('TG205', 'TG205-T002', 'Final', 'Evaluacion final', '{"weight":0.6}'::jsonb),
				('TG205', 'TG205-T003', 'Proyecto', 'Evaluacion por proyecto', '{"weight":1}'::jsonb),
				('TG206', 'TG206-T001', 'Rubrica', 'Instrumento tipo rubrica', '{}'::jsonb),
				('TG301', 'TG301-T001', 'Comision de programa', 'Comision de acreditacion de programa', '{}'::jsonb),
				('TG302', 'TG302-T001', 'Outcome ABET', 'Resultado de aprendizaje acreditable', '{}'::jsonb),
				('TG401', 'TG401-T001', 'Rubrica de proyecto', 'Rubrica para proyectos academicos', '{}'::jsonb),
				('TG401', 'TG401-T002', 'Rubrica de curso', 'Rubrica para evidencias de curso', '{}'::jsonb),
				('TG402', 'TG402-T001', 'Producto', 'Segmento producto final', '{}'::jsonb),
				('TG402', 'TG402-T002', 'Proceso', 'Segmento proceso de trabajo', '{}'::jsonb),
				('TG403', 'TG403-T001', 'Docente evaluador', 'Docente evaluador del proyecto', '{}'::jsonb),
				('TG403', 'TG403-T002', 'Estudiante participante', 'Estudiante participante del proyecto', '{}'::jsonb),
				('TG404', 'TG404-T001', 'Pendiente', 'Evaluacion pendiente', '{}'::jsonb),
				('TG404', 'TG404-T002', 'Completada', 'Evaluacion completada', '{}'::jsonb),
				('TG501', 'TG501-T001', 'Examen', 'Instrumento de examen', '{}'::jsonb),
				('TG501', 'TG501-T002', 'Proyecto', 'Instrumento de proyecto', '{}'::jsonb),
				('TG501', 'TG501-T003', 'Encuesta', 'Instrumento de encuesta', '{}'::jsonb),
				('TG601', 'TG601-T001', 'Satisfaccion estudiantil', 'Encuesta a estudiantes', '{}'::jsonb),
				('TG601', 'TG601-T002', 'Egresados', 'Encuesta a egresados', '{}'::jsonb),
				('TG602', 'TG602-T001', 'Activa', 'Encuesta activa', '{}'::jsonb),
				('TG602', 'TG602-T002', 'Cerrada', 'Encuesta cerrada', '{}'::jsonb),
				('TG701', 'TG701-T001', 'No medido', 'Indicador sin medicion', '{}'::jsonb),
				('TG701', 'TG701-T002', 'Analizado', 'Indicador analizado', '{}'::jsonb),
				('TG701', 'TG701-T003', 'Plan requerido', 'Indicador requiere plan', '{}'::jsonb),
				('TG801', 'TG801-T001', 'Baja', 'Criticidad baja', '{}'::jsonb),
				('TG801', 'TG801-T002', 'Media', 'Criticidad media', '{}'::jsonb),
				('TG801', 'TG801-T003', 'Alta', 'Criticidad alta', '{}'::jsonb),
				('TG901', 'TG901-T001', 'Administrador', 'Administrador del sistema', '{}'::jsonb),
				('TG901', 'TG901-T002', 'Coordinador de calidad', 'Coordinador de calidad academica', '{}'::jsonb),
				('TG901', 'TG901-T003', 'Profesor', 'Docente del programa', '{}'::jsonb),
				('TG902', 'TG902-T001', 'Rectorado', 'Nivel rectorado', '{"level":1}'::jsonb),
				('TG902', 'TG902-T002', 'Facultad', 'Nivel facultad', '{"level":2}'::jsonb),
				('TG902', 'TG902-T003', 'Escuela', 'Nivel escuela', '{"level":3}'::jsonb),
				('TG903', 'TG903-T001', 'Unidad academica', 'Entidad academica', '{}'::jsonb),
				('TG903', 'TG903-T002', 'Unidad administrativa', 'Entidad administrativa', '{}'::jsonb),
				('TG1001', 'TG1001-T001', 'Programada', 'Notificacion programada', '{}'::jsonb),
				('TG1001', 'TG1001-T002', 'Enviada', 'Notificacion enviada', '{}'::jsonb)
		) AS v(group_code, code, name, description, extra)
			ON tg.code = v.group_code
		WHERE NOT EXISTS (
			SELECT 1 FROM "core"."types" t WHERE t.code = v.code
		);
	`);
});
