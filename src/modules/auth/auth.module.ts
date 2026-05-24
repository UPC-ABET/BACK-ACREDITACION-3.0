import { Module } from '@nestjs/common';
import { UserModule } from '../organization/users/users.module';
import { SchoolModule } from '../organization/schools/schools.module';
import { AuthController } from './api/auth.controller';
import { AuthContextController } from './api/auth-context.controller';
import { AuthService } from './api/auth.service';
import { AuthContextGuard } from './protocols/jwt/guards/auth-context.guard';

@Module({
	imports: [UserModule, SchoolModule],
	controllers: [AuthController, AuthContextController],
	providers: [AuthService, AuthContextGuard],
})
export class AuthModule {}
