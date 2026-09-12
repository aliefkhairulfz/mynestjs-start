import { IsEmail, IsEnum, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SignUpReqDto {
    @ApiProperty({ example: 'John Doe', description: 'User full name' })
    @IsNotEmpty({ message: 'Name must not be empty' })
    @IsString({ message: 'Name must be a string' })
    @MinLength(2, { message: 'Name must be at least 2 characters' })
    name: string;

    @ApiProperty({ example: 'john@example.com', description: 'User email address' })
    @IsNotEmpty({ message: 'Email must not be empty' })
    @IsEmail({}, { message: 'Invalid email' })
    email: string;

    @ApiProperty({ example: 'Password123!', description: 'User password (min 8 chars)' })
    @IsNotEmpty({ message: 'Password must not be empty' })
    @IsString({ message: 'Password must be a string' })
    @MinLength(8, { message: 'Password must be at least 8 characters' })
    password: string;

    @ApiProperty({ example: 'credentials', enum: ['credentials', 'google'], description: 'Sign up provider' })
    @IsNotEmpty({ message: 'Provider must not be empty' })
    @IsString({ message: 'Provider must be a string' })
    @IsEnum(['credentials', 'google'], { message: "Provider must be 'credentials' or 'google'" })
    providerId: 'credentials' | 'google';
}

export class SignInReqDto {
    @ApiProperty({ example: 'john@example.com', description: 'User email address' })
    @IsNotEmpty({ message: 'Email must not be empty' })
    @IsEmail({}, { message: 'Invalid email' })
    email: string;

    @ApiProperty({ example: 'Password123!', description: 'User password' })
    @IsNotEmpty({ message: 'Password must not be empty' })
    @IsString({ message: 'Password must be a string' })
    @MinLength(8, { message: 'Password must be at least 8 characters' })
    password: string;

    @ApiProperty({ example: 'credentials', enum: ['credentials', 'google'], description: 'Sign in provider' })
    @IsNotEmpty({ message: 'Provider must not be empty' })
    @IsString({ message: 'Provider must be a string' })
    @IsEnum(['credentials', 'google'], { message: "Provider must be 'credentials' or 'google'" })
    providerId: 'credentials' | 'google';
}

export class ConfirmVerificationReqDto {
    @ApiProperty({ example: 'john@example.com', description: 'User email address' })
    @IsNotEmpty({ message: 'Email must not be empty' })
    @IsEmail({}, { message: 'Invalid email' })
    email: string;

    @ApiProperty({ example: '123456', description: 'Email verification OTP' })
    @IsNotEmpty({ message: 'OTP must not be empty' })
    @IsString({ message: 'OTP must be a string' })
    otp: string;
}

export class ResendVerificationReqDto {
    @ApiProperty({ example: 'john@example.com', description: 'User email address' })
    @IsNotEmpty({ message: 'Email must not be empty' })
    @IsEmail({}, { message: 'Invalid email' })
    email: string;
}

export class SignUpDataDto {
    @ApiProperty({ example: 'clq9...', description: 'User ID' })
    userId: string;
    @ApiProperty({ example: 'John Doe', description: 'User name' })
    name: string;
    @ApiProperty({ example: 'john@example.com', description: 'User email' })
    email: string;
    @ApiProperty({ example: 'user', description: 'User role' })
    role: string;
}

export class SignUpResDto {
    @ApiProperty({ type: SignUpDataDto, description: 'Registered user basic data' })
    data: SignUpDataDto;
    @ApiProperty({ example: 'sign-up success' })
    message: string;
}

export class SignInDataDto {
    @ApiProperty({ example: 'clq9...', description: 'User ID' })
    id: string;
    @ApiProperty({ example: 'John Doe', description: 'User name' })
    name: string;
    @ApiProperty({ example: 'john@example.com', description: 'User email' })
    email: string;
}

export class SignInResDto {
    @ApiProperty({ type: SignInDataDto, description: 'Authenticated user basic data' })
    data: SignInDataDto;
    @ApiProperty({ example: 'sign-in success' })
    message: string;
}

export class GetUserDataDto {
    @ApiProperty({ example: 'clq9...', description: 'User ID' })
    id: string;
    @ApiProperty({ example: 'John Doe', description: 'User name' })
    name: string;
    @ApiProperty({ example: 'john@example.com', description: 'User email' })
    email: string;
    @ApiProperty({ example: '2026-09-11T13:17:03.000Z', required: false, nullable: true })
    verifiedAt: Date | null;
    @ApiProperty({ example: 'https://example.com/avatar.jpg', required: false, nullable: true })
    image: string | null;
    @ApiProperty({ example: ['user'], isArray: true })
    roles: string[];
}

export class GetUserResDto {
    @ApiProperty({ type: GetUserDataDto, description: 'Current user profile data' })
    data: GetUserDataDto;
    @ApiProperty({ example: 'get-user success' })
    message: string;
}

export class ConfirmVerificationDataDto {
    @ApiProperty({ example: 'john@example.com' })
    email: string;
}

export class ConfirmVerificationResDto {
    @ApiProperty({ type: ConfirmVerificationDataDto })
    data: ConfirmVerificationDataDto;
    @ApiProperty({ example: 'email verification success' })
    message: string;
}
