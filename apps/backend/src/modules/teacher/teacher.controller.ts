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

/**
 * Cung cấp API cổng giáo viên cho lớp, trẻ, tăng trưởng, bữa ăn, ghi chú và cảnh báo.
 * Các đường dẫn bên dưới được ghép với tiền tố toàn cục /api/v1.
 * JwtAuthGuard xác thực tài khoản; RolesGuard kiểm tra quyền tại controller hoặc từng endpoint.
 * Constructor nhận service qua Dependency Injection; các hàm chuyển dữ liệu request sang service.
 */
@Controller('teacher') @UseGuards(JwtAuthGuard,RolesGuard) @Roles('TEACHER','SUPER_ADMIN')
export class TeacherController{
 constructor(private readonly service:TeacherService){}
 /**
  * GET /teacher/classes: Lấy danh sách lớp theo bộ lọc và phạm vi truy cập của giáo viên đang đăng nhập.
  * @param a Thông tin tài khoản đã xác thực.
  * @param q Bộ lọc trong query string.
  * Chuyển xử lý sang TeacherService.classList() và trả kết quả cho client.
  */
 @Get('classes') classes(@CurrentUser() a:any,@Query() q:any){return this.service.classList(a,q);}
 /**
  * GET /teacher/classes/:id: Đọc chi tiết lớp theo ID, kèm tài khoản giáo viên để service kiểm tra phạm vi truy cập.
  * @param a Thông tin tài khoản đã xác thực.
  * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
  * Chuyển xử lý sang TeacherService.classDetail() và trả kết quả cho client.
  */
 @Get('classes/:id') classDetail(@CurrentUser() a:any,@Param('id',ParseIntPipe) id:number){return this.service.classDetail(a,id);}
 /**
  * PATCH /teacher/classes/:id: Cập nhật lớp theo ID và UpdateClassDto, có truyền người thực hiện sang service.
  * @param a Thông tin tài khoản đã xác thực.
  * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
  * @param d Dữ liệu body JSON, kiểu UpdateClassDto.
  * Chuyển xử lý sang TeacherService.updateClass() và trả kết quả cho client.
  */
 @Patch('classes/:id') updateClass(@CurrentUser() a:any,@Param('id',ParseIntPipe) id:number,@Body() d:UpdateClassDto){return this.service.updateClass(a,id,d);}
 /**
  * GET /teacher/children: Lấy danh sách trẻ theo bộ lọc và tài khoản giáo viên đang đăng nhập.
  * @param a Thông tin tài khoản đã xác thực.
  * @param q Bộ lọc trong query string.
  * Chuyển xử lý sang TeacherService.childList() và trả kết quả cho client.
  */
 @Get('children') children(@CurrentUser() a:any,@Query() q:any){return this.service.childList(a,q);}
 /**
  * POST /teacher/children/import: Nhận mảng items trong body để nhập hồ sơ trẻ trong phạm vi giáo viên.
  * @param a Thông tin tài khoản đã xác thực.
  * @param items Trường items trong body JSON.
  * Chuyển xử lý sang TeacherService.importChildren() và trả kết quả cho client.
  */
 @Post('children/import') importChildren(@CurrentUser() a:any,@Body('items') items:any[]){return this.service.importChildren(a,items);}
 /**
  * GET /teacher/children/:id/nutrition-profile: Đọc hồ sơ dinh dưỡng của trẻ theo ID và người truy cập.
  * @param a Thông tin tài khoản đã xác thực.
  * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
  * Chuyển xử lý sang TeacherService.profile() và trả kết quả cho client.
  */
 @Get('children/:id/nutrition-profile') profile(@CurrentUser() a:any,@Param('id',ParseIntPipe) id:number){return this.service.profile(a,id);}
 /**
  * PATCH /teacher/children/:id/nutrition-profile: Cập nhật hồ sơ dinh dưỡng của trẻ bằng UpdateNutritionProfileDto.
  * @param a Thông tin tài khoản đã xác thực.
  * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
  * @param d Dữ liệu body JSON, kiểu UpdateNutritionProfileDto.
  * Chuyển xử lý sang TeacherService.profile() và trả kết quả cho client.
  */
 @Patch('children/:id/nutrition-profile') saveProfile(@CurrentUser() a:any,@Param('id',ParseIntPipe) id:number,@Body() d:UpdateNutritionProfileDto){return this.service.profile(a,id,d);}
 /**
  * GET /teacher/children/:id: Đọc chi tiết hồ sơ trẻ theo ID trong phạm vi người đang đăng nhập.
  * @param a Thông tin tài khoản đã xác thực.
  * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
  * Chuyển xử lý sang TeacherService.childDetail() và trả kết quả cho client.
  */
 @Get('children/:id') child(@CurrentUser() a:any,@Param('id',ParseIntPipe) id:number){return this.service.childDetail(a,id);}
 /**
  * POST /teacher/children: Tạo hồ sơ trẻ từ CreateChildDto và thông tin giáo viên thực hiện.
  * @param a Thông tin tài khoản đã xác thực.
  * @param d Dữ liệu body JSON, kiểu CreateChildDto.
  * Chuyển xử lý sang TeacherService.createChild() và trả kết quả cho client.
  */
 @Post('children') createChild(@CurrentUser() a:any,@Body() d:CreateChildDto){return this.service.createChild(a,d);}
 /**
  * PATCH /teacher/children/:id: Cập nhật hồ sơ trẻ theo ID và UpdateChildDto.
  * @param a Thông tin tài khoản đã xác thực.
  * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
  * @param d Dữ liệu body JSON, kiểu UpdateChildDto.
  * Chuyển xử lý sang TeacherService.updateChild() và trả kết quả cho client.
  */
 @Patch('children/:id') saveChild(@CurrentUser() a:any,@Param('id',ParseIntPipe) id:number,@Body() d:UpdateChildDto){return this.service.updateChild(a,id,d);}
 /**
  * GET /teacher/growth: Lấy danh sách hồ sơ tăng trưởng theo bộ lọc cho giáo viên.
  * @param a Thông tin tài khoản đã xác thực.
  * @param q Bộ lọc trong query string.
  * Chuyển xử lý sang TeacherService.growthList() và trả kết quả cho client.
  */
 @Get('growth') growth(@CurrentUser() a:any,@Query() q:any){return this.service.growthList(a,q);}
 /**
  * GET /teacher/growth/child/:id: Đọc lịch sử các lần đo thể chất của trẻ theo ID.
  * @param a Thông tin tài khoản đã xác thực.
  * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
  * Chuyển xử lý sang TeacherService.growthHistory() và trả kết quả cho client.
  */
 @Get('growth/child/:id') history(@CurrentUser() a:any,@Param('id',ParseIntPipe) id:number){return this.service.growthHistory(a,id);}
 /**
  * POST /teacher/growth/import: Nhập mảng kết quả đo items và truyền giáo viên thực hiện sang service.
  * @param a Thông tin tài khoản đã xác thực.
  * @param items Trường items trong body JSON.
  * Chuyển xử lý sang TeacherService.growthImport() và trả kết quả cho client.
  */
 @Post('growth/import') importGrowth(@CurrentUser() a:any,@Body('items') items:any[]){return this.service.growthImport(a,items);}
 /**
  * POST /teacher/growth: Ghi nhận lần đo mới từ CreateGrowthRecordDto.
  * @param a Thông tin tài khoản đã xác thực.
  * @param d Dữ liệu body JSON, kiểu CreateGrowthRecordDto.
  * Chuyển xử lý sang TeacherService.growthWrite() và trả kết quả cho client.
  */
 @Post('growth') createGrowth(@CurrentUser() a:any,@Body() d:CreateGrowthRecordDto){return this.service.growthWrite(a,d);}
 /**
  * PUT /teacher/growth/:id: Cập nhật lần đo có ID trên URL bằng dữ liệu CreateGrowthRecordDto.
  * @param a Thông tin tài khoản đã xác thực.
  * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
  * @param d Dữ liệu body JSON, kiểu CreateGrowthRecordDto.
  * Chuyển xử lý sang TeacherService.growthWrite() và trả kết quả cho client.
  */
 @Put('growth/:id') saveGrowth(@CurrentUser() a:any,@Param('id',ParseIntPipe) id:number,@Body() d:CreateGrowthRecordDto){return this.service.growthWrite(a,d,id);}
 /**
  * GET /teacher/meal-attendance: Lấy danh sách điểm danh bữa ăn theo bộ lọc và người đang đăng nhập.
  * @param a Thông tin tài khoản đã xác thực.
  * @param q Bộ lọc trong query string.
  * Chuyển xử lý sang TeacherService.mealList() và trả kết quả cho client.
  */
 @Get('meal-attendance') meals(@CurrentUser() a:any,@Query() q:any){return this.service.mealList(a,q);}
 /**
  * GET /teacher/meal-submissions: Lấy danh sách các lần chốt hoặc gửi thông tin bữa ăn theo bộ lọc.
  * @param a Thông tin tài khoản đã xác thực.
  * @param q Bộ lọc trong query string.
  * Chuyển xử lý sang TeacherService.mealSubmissions() và trả kết quả cho client.
  */
 @Get('meal-submissions') mealSubmissions(@CurrentUser() a:any,@Query() q:any){return this.service.mealSubmissions(a,q);}
 /**
  * POST /teacher/meal-submissions: Nhận dữ liệu chốt bữa ăn và chuyển sang service cùng tài khoản giáo viên.
  * @param a Thông tin tài khoản đã xác thực.
  * @param d Dữ liệu body JSON.
  * Chuyển xử lý sang TeacherService.submitMeals() và trả kết quả cho client.
  */
 @Post('meal-submissions') submitMeals(@CurrentUser() a:any,@Body() d:any){return this.service.submitMeals(a,d);}
 /**
  * PUT /teacher/meal-attendance/:id: Cập nhật bản ghi điểm danh bữa ăn theo ID và nội dung JSON trong body.
  * @param a Thông tin tài khoản đã xác thực.
  * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
  * @param d Dữ liệu body JSON.
  * Chuyển xử lý sang TeacherService.mealWrite() và trả kết quả cho client.
  */
 @Put('meal-attendance/:id') saveMeal(@CurrentUser() a:any,@Param('id',ParseIntPipe) id:number,@Body() d:any){return this.service.mealWrite(a,id,d);}
 /**
  * GET /teacher/meal-history: Tra cứu lịch sử bữa ăn theo bộ lọc và phạm vi giáo viên.
  * @param a Thông tin tài khoản đã xác thực.
  * @param q Bộ lọc trong query string.
  * Chuyển xử lý sang TeacherService.history() và trả kết quả cho client.
  */
 @Get('meal-history') mealHistory(@CurrentUser() a:any,@Query() q:any){return this.service.history(a,q);}
 /**
  * GET /teacher/snack-roster: Lấy danh sách trẻ đăng ký ăn xế theo bộ lọc của cổng giáo viên.
  * @param a Thông tin tài khoản đã xác thực.
  * @param q Bộ lọc trong query string.
  * Chuyển xử lý sang TeacherService.roster() và trả kết quả cho client.
  */
 @Get('snack-roster') roster(@CurrentUser() a:any,@Query() q:any){return this.service.roster(a,q);}
 /**
  * GET /teacher/portions: Lấy số suất ăn theo bộ lọc và thông tin giáo viên đang đăng nhập.
  * @param a Thông tin tài khoản đã xác thực.
  * @param q Bộ lọc trong query string.
  * Chuyển xử lý sang TeacherService.portions() và trả kết quả cho client.
  */
 @Get('portions') portions(@CurrentUser() a:any,@Query() q:any){return this.service.portions(a,q);}
 /**
  * PUT /teacher/portions: Chuyển dữ liệu số suất ăn sang service để xử lý cập nhật cho giáo viên.
  * @param a Thông tin tài khoản đã xác thực.
  * @param d Dữ liệu body JSON.
  * Chuyển xử lý sang TeacherService.portionWrite() và trả kết quả cho client.
  */
 @Put('portions') savePortions(@CurrentUser() a:any,@Body() d:any){return this.service.portionWrite(a,d);}
 /**
  * GET /teacher/notes: Lấy ghi chú phối hợp giáo viên - bếp theo bộ lọc.
  * @param a Thông tin tài khoản đã xác thực.
  * @param q Bộ lọc trong query string.
  * Chuyển xử lý sang TeacherService.noteList() và trả kết quả cho client.
  */
 @Get('notes') notes(@CurrentUser() a:any,@Query() q:any){return this.service.noteList(a,q);}
 /**
  * POST /teacher/notes: Tạo ghi chú phối hợp từ nội dung body và tài khoản giáo viên.
  * @param a Thông tin tài khoản đã xác thực.
  * @param d Dữ liệu body JSON.
  * Chuyển xử lý sang TeacherService.noteWrite() và trả kết quả cho client.
  */
 @Post('notes') createNote(@CurrentUser() a:any,@Body() d:any){return this.service.noteWrite(a,d);}
 /**
  * PUT /teacher/notes/:id: Cập nhật ghi chú có ID trên URL bằng nội dung body.
  * @param a Thông tin tài khoản đã xác thực.
  * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
  * @param d Dữ liệu body JSON.
  * Chuyển xử lý sang TeacherService.noteWrite() và trả kết quả cho client.
  */
 @Put('notes/:id') saveNote(@CurrentUser() a:any,@Param('id',ParseIntPipe) id:number,@Body() d:any){return this.service.noteWrite(a,d,id);}
 /**
  * DELETE /teacher/notes/:id: Yêu cầu xóa ghi chú theo ID và người thực hiện.
  * @param a Thông tin tài khoản đã xác thực.
  * @param id Giá trị id trên URL, được ParseIntPipe kiểm tra và chuyển thành số nguyên.
  * Chuyển xử lý sang TeacherService.noteDelete() và trả kết quả cho client.
  */
 @Delete('notes/:id') deleteNote(@CurrentUser() a:any,@Param('id',ParseIntPipe) id:number){return this.service.noteDelete(a,id);}
 /**
  * GET /teacher/nutrition-advice/detect: Yêu cầu phát hiện tình trạng ăn kém của trẻ theo bộ lọc.
  * @param a Thông tin tài khoản đã xác thực.
  * @param q Bộ lọc trong query string.
  * Chuyển xử lý sang TeacherService.picky() và trả kết quả cho client.
  */
 @Get('nutrition-advice/detect') detect(@CurrentUser() a:any,@Query() q:any){return this.service.picky(a,q);}
 /**
  * GET /teacher/nutrition-advice/history: Lấy lịch sử tư vấn dinh dưỡng, có thể lọc theo studentId trong query.
  * @param a Thông tin tài khoản đã xác thực.
  * @param id Tham số studentId trong query string (tùy chọn).
  * Chuyển xử lý sang TeacherService.adviceHistory() và trả kết quả cho client.
  */
 @Get('nutrition-advice/history') adviceHistory(@CurrentUser() a:any,@Query('studentId') id?:string){return this.service.adviceHistory(a,id);}
 /**
  * POST /teacher/nutrition-advice/send: Gửi yêu cầu tư vấn dinh dưỡng từ body cùng thông tin giáo viên.
  * @param a Thông tin tài khoản đã xác thực.
  * @param d Dữ liệu body JSON.
  * Chuyển xử lý sang TeacherService.sendAdvice() và trả kết quả cho client.
  */
 @Post('nutrition-advice/send') sendAdvice(@CurrentUser() a:any,@Body() d:any){return this.service.sendAdvice(a,d);}
 /**
  * GET /teacher/growth-notifications: Lấy thông báo tăng trưởng theo bộ lọc và tài khoản giáo viên.
  * @param a Thông tin tài khoản đã xác thực.
  * @param q Bộ lọc trong query string.
  * Chuyển xử lý sang TeacherService.notifications() và trả kết quả cho client.
  */
 @Get('growth-notifications') notifications(@CurrentUser() a:any,@Query() q:any){return this.service.notifications(a,q);}
 /**
  * POST /teacher/growth-notifications/scan-dispatch: Yêu cầu quét và điều phối thông báo tăng trưởng cho phạm vi giáo viên.
  * @param a Thông tin tài khoản đã xác thực.
  * Chuyển xử lý sang TeacherService.scan() và trả kết quả cho client.
  */
 @Post('growth-notifications/scan-dispatch') scan(@CurrentUser() a:any){return this.service.scan(a);}
 /**
  * GET /teacher/alerts: Lấy cảnh báo liên quan đến trẻ theo bộ lọc và tài khoản giáo viên.
  * @param a Thông tin tài khoản đã xác thực.
  * @param q Bộ lọc trong query string.
  * Chuyển xử lý sang TeacherService.alerts() và trả kết quả cho client.
  */
 @Get('alerts') alerts(@CurrentUser() a:any,@Query() q:any){return this.service.alerts(a,q);}
 /**
  * GET /teacher/meal-report: Lấy báo cáo bữa ăn theo bộ lọc của cổng giáo viên.
  * @param a Thông tin tài khoản đã xác thực.
  * @param q Bộ lọc trong query string.
  * Chuyển xử lý sang TeacherService.report() và trả kết quả cho client.
  */
 @Get('meal-report') report(@CurrentUser() a:any,@Query() q:any){return this.service.report(a,q);}
}
