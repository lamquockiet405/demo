import {Body,Controller,Delete,Get,Param,ParseIntPipe,Patch,Post,Put,Query,UseGuards} from '@nestjs/common';
import {JwtAuthGuard} from '../../common/guards/jwt-auth.guard';
import {RolesGuard} from '../../common/guards/roles.guard';
import {Roles} from '../../common/decorators/roles.decorator';
import {CurrentUser} from '../../common/decorators/current-user.decorator';
import {TeacherService} from './teacher.service';
import {CreateChildDto} from '../children/dto/create-child.dto';
import {UpdateChildDto} from '../children/dto/update-child.dto';
import {UpdateNutritionProfileDto} from '../children/dto/update-nutrition-profile.dto';
import {CreateGrowthRecordDto} from '../growth/dto/create-growth-record.dto';
import {UpdateClassDto} from '../classes/dto/update-class.dto';

@Controller('teacher') @UseGuards(JwtAuthGuard,RolesGuard) @Roles('TEACHER','SUPER_ADMIN')
export class TeacherController{
 constructor(private readonly service:TeacherService){}
 @Get('classes') classes(@CurrentUser() a:any,@Query() q:any){return this.service.classList(a,q);}
 @Get('classes/:id') classDetail(@CurrentUser() a:any,@Param('id',ParseIntPipe) id:number){return this.service.classDetail(a,id);}
 @Patch('classes/:id') updateClass(@CurrentUser() a:any,@Param('id',ParseIntPipe) id:number,@Body() d:UpdateClassDto){return this.service.updateClass(a,id,d);}
 @Get('children') children(@CurrentUser() a:any,@Query() q:any){return this.service.childList(a,q);}
 @Post('children/import') importChildren(@CurrentUser() a:any,@Body('items') items:any[]){return this.service.importChildren(a,items);}
 @Get('children/:id/nutrition-profile') profile(@CurrentUser() a:any,@Param('id',ParseIntPipe) id:number){return this.service.profile(a,id);}
 @Patch('children/:id/nutrition-profile') saveProfile(@CurrentUser() a:any,@Param('id',ParseIntPipe) id:number,@Body() d:UpdateNutritionProfileDto){return this.service.profile(a,id,d);}
 @Get('children/:id') child(@CurrentUser() a:any,@Param('id',ParseIntPipe) id:number){return this.service.childDetail(a,id);}
 @Post('children') createChild(@CurrentUser() a:any,@Body() d:CreateChildDto){return this.service.createChild(a,d);}
 @Patch('children/:id') saveChild(@CurrentUser() a:any,@Param('id',ParseIntPipe) id:number,@Body() d:UpdateChildDto){return this.service.updateChild(a,id,d);}
 @Get('growth') growth(@CurrentUser() a:any,@Query() q:any){return this.service.growthList(a,q);}
 @Get('growth/child/:id') history(@CurrentUser() a:any,@Param('id',ParseIntPipe) id:number){return this.service.growthHistory(a,id);}
 @Post('growth/import') importGrowth(@CurrentUser() a:any,@Body('items') items:any[]){return this.service.growthImport(a,items);}
 @Post('growth') createGrowth(@CurrentUser() a:any,@Body() d:CreateGrowthRecordDto){return this.service.growthWrite(a,d);}
 @Put('growth/:id') saveGrowth(@CurrentUser() a:any,@Param('id',ParseIntPipe) id:number,@Body() d:CreateGrowthRecordDto){return this.service.growthWrite(a,d,id);}
 @Get('meal-attendance') meals(@CurrentUser() a:any,@Query() q:any){return this.service.mealList(a,q);}
 @Get('meal-submissions') mealSubmissions(@CurrentUser() a:any,@Query() q:any){return this.service.mealSubmissions(a,q);}
 @Post('meal-submissions') submitMeals(@CurrentUser() a:any,@Body() d:any){return this.service.submitMeals(a,d);}
 @Put('meal-attendance/:id') saveMeal(@CurrentUser() a:any,@Param('id',ParseIntPipe) id:number,@Body() d:any){return this.service.mealWrite(a,id,d);}
 @Get('meal-history') mealHistory(@CurrentUser() a:any,@Query() q:any){return this.service.history(a,q);}
 @Get('snack-roster') roster(@CurrentUser() a:any,@Query() q:any){return this.service.roster(a,q);}
 @Get('portions') portions(@CurrentUser() a:any,@Query() q:any){return this.service.portions(a,q);}
 @Put('portions') savePortions(@CurrentUser() a:any,@Body() d:any){return this.service.portionWrite(a,d);}
 @Get('notes') notes(@CurrentUser() a:any,@Query() q:any){return this.service.noteList(a,q);}
 @Post('notes') createNote(@CurrentUser() a:any,@Body() d:any){return this.service.noteWrite(a,d);}
 @Put('notes/:id') saveNote(@CurrentUser() a:any,@Param('id',ParseIntPipe) id:number,@Body() d:any){return this.service.noteWrite(a,d,id);}
 @Delete('notes/:id') deleteNote(@CurrentUser() a:any,@Param('id',ParseIntPipe) id:number){return this.service.noteDelete(a,id);}
 @Get('nutrition-advice/detect') detect(@CurrentUser() a:any,@Query() q:any){return this.service.picky(a,q);}
 @Get('nutrition-advice/history') adviceHistory(@CurrentUser() a:any,@Query('studentId') id?:string){return this.service.adviceHistory(a,id);}
 @Post('nutrition-advice/send') sendAdvice(@CurrentUser() a:any,@Body() d:any){return this.service.sendAdvice(a,d);}
 @Get('growth-notifications') notifications(@CurrentUser() a:any,@Query() q:any){return this.service.notifications(a,q);}
 @Post('growth-notifications/scan-dispatch') scan(@CurrentUser() a:any){return this.service.scan(a);}
 @Get('alerts') alerts(@CurrentUser() a:any,@Query() q:any){return this.service.alerts(a,q);}
 @Get('meal-report') report(@CurrentUser() a:any,@Query() q:any){return this.service.report(a,q);}
}
