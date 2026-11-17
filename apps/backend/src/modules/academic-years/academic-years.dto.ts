import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { PartialType } from '@nestjs/swagger';

export class CreateAcademicYearDto {
  @IsString() @IsNotEmpty() @MaxLength(20) name: string;
  @IsDateString({ strict: true }) startDate: string;
  @IsDateString({ strict: true }) endDate: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) sourceYearId?: number;
  @IsOptional() @IsString() @MaxLength(4000) notes?: string;
}
export class UpdateAcademicYearDto extends PartialType(CreateAcademicYearDto) {}

export class YearClassDto {
  @IsString() @IsNotEmpty() @MaxLength(50) name: string;
  @IsIn(['NHA_TRE', 'MAU_GIAO']) ageGroup: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) homeroomTeacherId?: number;
  @IsOptional() @IsIn(['ACTIVE', 'INACTIVE']) status?: string;
}
export class UpdateYearClassDto extends PartialType(YearClassDto) {}

class ParentContactDto {
  @IsOptional() @IsString() parentId?: string;
  @IsString() @IsNotEmpty() @MaxLength(150) fullName: string;
  @IsString() @MaxLength(20) phone: string;
  @IsOptional() @IsString() @MaxLength(255) email?: string;
  @IsIn(['FATHER', 'MOTHER', 'GUARDIAN']) relationship: string;
  @IsBoolean() isPrimary: boolean;
}
export class UpdateYearEnrollmentDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) classId?: number;
  @IsOptional() @IsIn(['ENROLLED', 'LEFT', 'GRADUATED']) status?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(150) fullName?: string;
  @IsOptional() @IsDateString({ strict: true }) dateOfBirth?: string;
  @IsOptional() @IsIn(['MALE', 'FEMALE']) gender?: string;
  @IsOptional() @IsString() @MaxLength(4000) notes?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => ParentContactDto)
  parentContacts?: ParentContactDto[];
}
export class AddYearEnrollmentDto {
  @Type(() => Number) @IsInt() @Min(1) studentId: number;
  @Type(() => Number) @IsInt() @Min(1) classId: number;
}
export class CreateYearStudentDto {
  @Type(() => Number) @IsInt() @Min(1) classId: number;
  @IsOptional() @IsString() @MaxLength(50) studentCode?: string;
  @IsString() @IsNotEmpty() @MaxLength(150) fullName: string;
  @IsDateString({ strict: true }) dateOfBirth: string;
  @IsIn(['MALE', 'FEMALE']) gender: string;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => ParentContactDto)
  parentContacts?: ParentContactDto[];
}
