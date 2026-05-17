import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserEntity } from './model/users.entity';
import { UserRepository } from './core/users.repository';
import { UserService } from './api/users.service';
import { UserController } from './api/users.controller';
import { SchoolModule } from 'src/modules/organization/schools/schools.module';

@Module({
	imports: [TypeOrmModule.forFeature([UserEntity]), SchoolModule],
	controllers: [UserController],
	providers: [UserService, UserRepository],
	exports: [UserService],
})
export class UserModule {}
