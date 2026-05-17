import { Module } from '@nestjs/common';
import { UserModule } from '../organization/users/users.module';
import { SchoolModule } from '../organization/schools/schools.module';
import { AuthController } from './api/auth.controller';
import { AuthService } from './api/auth.service';

@Module({
	imports: [UserModule, SchoolModule],
	controllers: [AuthController],
	providers: [AuthService],
})
export class AuthModule {}
