import { IsNotEmpty, IsOptional, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateChildDto {
  @ApiPropertyOptional({ example: 'Nguyễn Gia Huy' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ example: 'Huy' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Nguyễn Gia' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ example: '2020-03-15' })
  @IsNotEmpty({ message: 'Ngày sinh không được để trống' })
  @IsString()
  dateOfBirth: string;

  @ApiProperty({ example: 'MALE', enum: ['MALE', 'FEMALE'] })
  @IsNotEmpty({ message: 'Giới tính không được để trống' })
  @IsString()
  gender: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Mã lớp phải là số' })
  classId?: number;

  @ApiPropertyOptional({ example: 'HS-2024-001' })
  @IsOptional()
  @IsString()
  studentCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiPropertyOptional({ default: 'ACTIVE' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'Nguyễn Xuân An' })
  @IsOptional()
  @IsString()
  emergencyContactName?: string;

  @ApiPropertyOptional({ example: '0918273645' })
  @IsOptional()
  @IsString()
  emergencyContactPhone?: string;

  @ApiPropertyOptional({ example: 'Tiền sử sốt co giật' })
  @IsOptional()
  @IsString()
  medicalNotes?: string;
}
