// no-override — hand-curated validators (@IsEmail, etc.); generator skips this file.
import {
	IsBoolean,
	IsEmail,
	IsInt,
	IsNumber,
	IsOptional,
	IsPositive,
	IsString,
	Length,
	MaxLength,
	MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
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
	@ApiProperty({ example: 'firstNameExample', required: true })
	firstName: string;

	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'lastNameExample', required: true })
	lastName: string;

	@IsEmail()
	@MaxLength(254)
	@ApiProperty({ example: 'user@example.com', required: true })
	email: string;

	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: '+51 999 999 999', required: true })
	phone: string;

	@IsBoolean()
	@ApiProperty({ example: true, required: true })
	isAdmin: boolean;
}

export class UpdateUserDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
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
	@ApiProperty({ example: 'firstNameExample', required: false })
	firstName?: string;

	@IsOptional()
	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'lastNameExample', required: false })
	lastName?: string;

	@IsOptional()
	@IsEmail()
	@MaxLength(254)
	@ApiProperty({ example: 'user@example.com', required: false })
	email?: string;

	@IsOptional()
	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: '+51 999 999 999', required: false })
	phone?: string;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isAdmin?: boolean;
}

export class FilterUserDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
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
	@ApiProperty({ example: 'firstNameExample', required: false })
	firstName?: string;

	@IsOptional()
	@ApiProperty({ example: 'lastNameExample', required: false })
	lastName?: string;

	@IsOptional()
	@IsEmail()
	@MaxLength(254)
	@ApiProperty({ example: 'user@example.com', required: false })
	email?: string;

	@IsOptional()
	@ApiProperty({ example: '+51 999 999 999', required: false })
	phone?: string;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isAdmin?: boolean;
}

// %% OTHER DTOS
export class LoginUserByCredentialsDto {
	@IsEmail()
	@MaxLength(254)
	@ApiProperty({
		example: 'user@example.com',
		required: true,
	})
	email: string;

	@IsString()
	@MinLength(8)
	@ApiProperty({
		example: 'passwordExample',
		required: true,
	})
	password: string;
}

export class ChangeRoleDto {
	@IsNumber()
	@ApiProperty({ example: 1 })
	newRole: number;
}

export class GetMeDto {
	@IsInt()
	@IsPositive()
	@ApiProperty({ example: 1, required: true, description: 'Modality type ID' })
	modalityId: number;
}
