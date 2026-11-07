import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { AcademicYearsService } from './academic-years.service';
import { AcademicYearTenantGuard } from './academic-year-tenant.guard';
import { AddYearEnrollmentDto, CreateAcademicYearDto, CreateYearStudentDto, UpdateAcademicYearDto, UpdateYearClassDto, UpdateYearEnrollmentDto, YearClassDto } from './academic-years.dto';

@ApiTags('Academic years') @ApiBearerAuth()
@Controller('academic-years') @UseGuards(JwtAuthGuard, RolesGuard, AcademicYearTenantGuard) @Roles('PRINCIPAL')
export class AcademicYearsController {
  constructor(private readonly service: AcademicYearsService) {}
  @Get() list(@CurrentTenant() schoolId: number) { return this.service.list(schoolId); }
  @Get(':id/available-students') availableStudents(@Param('id', ParseIntPipe) id: number, @CurrentTenant() schoolId: number) {
    return this.service.availableStudents(id, schoolId);
  }
  @Get(':id') detail(@Param('id', ParseIntPipe) id: number, @CurrentTenant() schoolId: number) {
    return this.service.detail(id, schoolId);
  }
  @Post() create(@Body() dto: CreateAcademicYearDto, @CurrentTenant() schoolId: number) {
    return this.service.create(dto, schoolId);
  }
  @Patch(':id') update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAcademicYearDto, @CurrentTenant() schoolId: number) {
    return this.service.update(id, dto, schoolId);
  }
  @Post(':id/activate') activate(@Param('id', ParseIntPipe) id: number, @CurrentTenant() schoolId: number) {
    return this.service.activate(id, schoolId);
  }
  @Post(':id/complete') complete(@Param('id', ParseIntPipe) id: number, @CurrentTenant() schoolId: number) {
    return this.service.complete(id, schoolId);
  }
  @Post(':id/classes') addClass(@Param('id', ParseIntPipe) id: number, @Body() dto: YearClassDto, @CurrentTenant() schoolId: number) {
    return this.service.saveClass(id, null, dto, schoolId);
  }
  @Patch(':id/classes/:classId') updateClass(@Param('id', ParseIntPipe) id: number, @Param('classId', ParseIntPipe) classId: number,
    @Body() dto: UpdateYearClassDto, @CurrentTenant() schoolId: number) {
    return this.service.saveClass(id, classId, dto, schoolId);
  }
  @Post(':id/enrollments') addEnrollment(@Param('id', ParseIntPipe) id: number, @Body() dto: AddYearEnrollmentDto, @CurrentTenant() schoolId: number) {
    return this.service.addEnrollment(id, dto, schoolId);
  }
  @Post(':id/students') createStudent(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateYearStudentDto, @CurrentTenant() schoolId: number) {
    return this.service.createStudent(id, dto, schoolId);
  }
  @Patch(':id/enrollments/:enrollmentId') updateEnrollment(@Param('id', ParseIntPipe) id: number,
    @Param('enrollmentId', ParseIntPipe) enrollmentId: number, @Body() dto: UpdateYearEnrollmentDto, @CurrentTenant() schoolId: number) {
    return this.service.updateEnrollment(id, enrollmentId, dto, schoolId);
  }
}
