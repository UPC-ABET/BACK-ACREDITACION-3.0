import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignRepresentativeDto {
    @IsString()
    @IsNotEmpty()
    @ApiProperty({ example: '20231A456', description: 'Código del alumno en la tabla students' })
    studentCode: string;

    @IsString()
    @IsNotEmpty()
    @ApiProperty({ example: 'SOFT-INT-2026-2-A', description: 'Código de la sección en course_sections' })
    sectionCode: string;
}