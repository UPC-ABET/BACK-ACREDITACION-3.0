// no-override — hand-curated validators (@IsEmail, etc.); generator skips this file.
import {
	IsBoolean,
	IsEmail,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	Length,
	MaxLength,
	MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	documentTypeId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	documentCode: number;

	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'first_name_example', required: true })
	firstName: string;

	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'last_name_example', required: true })
	lastName: string;

	@IsEmail()
	@MaxLength(254)
	@ApiProperty({ example: 'user@example.com', required: true })
	email: string;

	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'phone_example', required: true })
	phone: string;

	@IsBoolean()
	@ApiProperty({ example: true, required: true })
	isAdmin: boolean;
}

export class UpdateUserDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	documentTypeId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	documentCode?: number;

	@IsOptional()
	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'first_name_example', required: false })
	firstName?: string;

	@IsOptional()
	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'last_name_example', required: false })
	lastName?: string;

	@IsOptional()
	@IsEmail()
	@MaxLength(254)
	@ApiProperty({ example: 'user@example.com', required: false })
	email?: string;

	@IsOptional()
	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'phone_example', required: false })
	phone?: string;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isAdmin?: boolean;
}

export class FilterUserDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	documentTypeId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	documentCode?: number;

	@IsOptional()
	@ApiProperty({ example: 'first_name_example', required: false })
	firstName?: string;

	@IsOptional()
	@ApiProperty({ example: 'last_name_example', required: false })
	lastName?: string;

	@IsOptional()
	@IsEmail()
	@MaxLength(254)
	@ApiProperty({ example: 'user@example.com', required: false })
	email?: string;

	@IsOptional()
	@ApiProperty({ example: 'phone_example', required: false })
	phone?: string;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isAdmin?: boolean;
}

// %% OTHER DTOS
export class LoginUserByCredentialsDto {
	@IsString()
	@IsNotEmpty()
	@ApiProperty({
		example: 'EISCB',
		required: true,
		description: 'Código de la escuela seleccionada por el usuario',
	})
	schoolCode: string;

	@IsEmail()
	@MaxLength(254)
	@ApiProperty({
		example: 'juan.perez@example.com',
		required: true,
	})
	email: string;

	@IsString()
	@MinLength(8)
	@ApiProperty({
		example: 'password123',
		required: true,
	})
	password: string;
}

export class ChangeRoleDto {
	@IsNumber()
	@ApiProperty({ example: 2 })
	newRole: number;
}
