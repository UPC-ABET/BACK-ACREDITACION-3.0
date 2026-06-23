import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentSectionEnrollmentEntity } from './model/class-representatives.entity';
import { ClassRepresentativesRepository } from './core/class-representatives.repository';
import { ClassRepresentativesService } from './api/class-representatives.service';
import { ClassRepresentativesController } from './api/class-representatives.controller';

@Module({
    imports: [TypeOrmModule.forFeature([StudentSectionEnrollmentEntity])],
    controllers: [ClassRepresentativesController],
    providers: [ClassRepresentativesService, ClassRepresentativesRepository],
    exports: [ClassRepresentativesService, ClassRepresentativesRepository],
})
export class ClassRepresentativesModule {}