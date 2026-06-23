import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { StudentSectionEnrollmentEntity } from '../model/class-representatives.entity';

// Interfaz actualizada con toda la información detallada del delegado
export interface ClassRepresentativeRow {
    id: number;
    isClassRepresentative: boolean;
    courseCode: string;
    courseName: string;
    sectionCode: string;
    studentCode: string;
    studentFullName: string;
}

@Injectable()
export class ClassRepresentativesRepository extends BaseRepository<StudentSectionEnrollmentEntity> {
    constructor(
        @InjectRepository(StudentSectionEnrollmentEntity)
        repository: Repository<StudentSectionEnrollmentEntity>,
        dataSource: DataSource,
    ) {
        super(repository, dataSource);
    }

    /**
     * Obtiene el listado detallado de todos los delegados activos con la información
     * de sus respectivos cursos, secciones y datos personales.
     */
    async findAllRepresentatives(): Promise<ClassRepresentativeRow[]> {
        return await this.dataSource.query(`
            SELECT 
                sse.id AS "id",
                sse.is_class_representative AS "isClassRepresentative",
                c.code AS "courseCode",
                c.name->>'es' AS "courseName",
                cs.section_code AS "sectionCode",
                s.code AS "studentCode",
                CONCAT(s.first_name, ' ', s.last_name) AS "studentFullName"
            FROM academic.student_section_enrollments sse
            INNER JOIN academic.course_sections cs ON sse.course_section_id = cs.id
            INNER JOIN academic.courses c ON cs.course_id = c.id
            INNER JOIN academic.enrolled_students es ON sse.enrolled_student_id = es.id
            INNER JOIN academic.students s ON es.student_id = s.id
            WHERE sse.is_class_representative = true 
              AND sse.is_active = true
              AND cs.is_active = true
              AND c.is_active = true
            ORDER BY c.code ASC, cs.section_code ASC
        `);
    }

    /**
     * Busca el registro de matrícula cruzando el código del alumno y de la sección.
     */
    async findEnrollmentByCodes(studentCode: string, sectionCode: string): Promise<StudentSectionEnrollmentEntity | null> {
        const rows = await this.dataSource.query(`
            SELECT sse.id AS "id"
            FROM academic.student_section_enrollments sse
            INNER JOIN academic.enrolled_students es ON sse.enrolled_student_id = es.id
            INNER JOIN academic.students s ON es.student_id = s.id
            INNER JOIN academic.course_sections cs ON sse.course_section_id = cs.id
            WHERE s.code = $1 
              AND cs.section_code = $2
              AND sse.is_active = true
        `, [studentCode, sectionCode]);

        return rows[0] || null;
    }
}