import {Module} from '@nestjs/common';
import {APP_INTERCEPTOR} from '@nestjs/core';
import {ClassesModule} from '../classes/classes.module';
import {ChildrenModule} from '../children/children.module';
import {GrowthModule} from '../growth/growth.module';
import {NutritionAdviceModule} from '../nutrition-advice/nutrition-advice.module';
import {AttendanceModule} from '../attendance/attendance.module';
import {TeacherService} from './teacher.service';
import {TeacherController} from './teacher.controller';
import {TeacherBoundaryInterceptor} from './teacher-boundary.interceptor';
@Module({imports:[ClassesModule,ChildrenModule,GrowthModule,NutritionAdviceModule,AttendanceModule],controllers:[TeacherController],providers:[TeacherService,{provide:APP_INTERCEPTOR,useClass:TeacherBoundaryInterceptor}]})
export class TeacherModule{}
