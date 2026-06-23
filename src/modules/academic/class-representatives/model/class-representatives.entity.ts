import { Entity } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { BooleanColumn, IntegerFKIDColumn } from 'src/commons/configs/db.configs';

@Entity({ schema: 'academic', name: 'student_section_enrollments' })
export class StudentSectionEnrollmentEntity extends BaseEntity {
    @IntegerFKIDColumn()
    enrolledStudentId: number;

    @IntegerFKIDColumn()
    courseSectionId: number;

    @BooleanColumn({ default: false })
    isClassRepresentative: boolean;
}