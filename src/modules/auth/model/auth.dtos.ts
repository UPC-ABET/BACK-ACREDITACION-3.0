import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class ForgotPasswordDto {
	@IsEmail()
	@ApiProperty({ example: 'juan.perez@example.com', required: true })
	email: string;
}

export class ResetPasswordDto {
	@IsEmail()
	@ApiProperty({ example: 'juan.perez@example.com', required: true })
	email: string;

	@IsString()
	@ApiProperty({ example: 'token-recibido-por-correo', required: true })
	token: string;

	@IsString()
	@MinLength(8)
	@ApiProperty({ example: 'nuevaPassword123', required: true, minLength: 8 })
	newPassword: string;
}
