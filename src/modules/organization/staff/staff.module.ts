import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { StaffEntity } from './model/staff.entity';
import { StaffRepository } from './core/staff.repository';
import { StaffService } from './api/staff.service';
import { StaffController } from './api/staff.controller';

@Module({
	imports: [TypeOrmModule.forFeature([StaffEntity])],
	controllers: [StaffController],
	providers: [StaffService, StaffRepository],
	exports: [StaffService, StaffRepository],
})
export class StaffModule {}
