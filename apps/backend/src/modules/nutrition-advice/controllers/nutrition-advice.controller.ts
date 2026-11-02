import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { NutritionAdviceService } from '../services/nutrition-advice.service';
import { SendHomeSupplementAdviceDto } from '../dto/send-advice.dto';
import { ConfirmAdviceDto } from '../dto/confirm-advice.dto';

@ApiTags('Picky Eating Detection & Home Nutrition Advice')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('nutrition-advice')
export class NutritionAdviceController {
  constructor(private readonly adviceService: NutritionAdviceService) {}

  @Get('detect')
  @ApiOperation({ summary: 'Phát hiện trẻ biếng ăn / kén ăn từ dữ liệu tiêu thụ thực tế' })
  @Roles('NUTRITIONIST', 'TEACHER', 'SCHOOL_MANAGER', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN')
  @ApiQuery({ name: 'classId', required: false, description: 'Lọc theo lớp học' })
  @ApiQuery({ name: 'search', required: false, description: 'Tìm theo tên hoặc mã học sinh' })
  async detectPickyEating(
    @Query('classId') classId?: string,
    @Query('search') search?: string,
  ) {
    return this.adviceService.detectPickyEating(classId, search);
  }

  @Post('send')
  @ApiOperation({ summary: 'Chuyên gia dinh dưỡng / Giáo viên gửi tư vấn bổ sung tại nhà cho phụ huynh' })
  @Roles('NUTRITIONIST', 'TEACHER', 'PRINCIPAL', 'SUPER_ADMIN')
  async sendAdvice(
    @Body() dto: SendHomeSupplementAdviceDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.adviceService.sendAdvice(dto, userId);
  }

  @Get('child-advice')
  @ApiOperation({ summary: 'Phụ huynh xem danh sách tư vấn bổ sung dinh dưỡng của con' })
  @Roles('PARENT', 'NUTRITIONIST', 'TEACHER', 'PRINCIPAL', 'SUPER_ADMIN')
  async getChildAdvice(
    @Query('childId') childId?: string,
    @CurrentUser('id') userId?: number,
  ) {
    return this.adviceService.getChildAdvice(childId, userId);
  }

  @Post(':id/confirm')
  @ApiOperation({ summary: 'Phụ huynh xác nhận đã đọc và gửi phản hồi áp dụng tại nhà' })
  @Roles('PARENT', 'PRINCIPAL', 'SUPER_ADMIN')
  async confirmAdvice(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConfirmAdviceDto,
    @CurrentUser('id') userId?: number,
  ) {
    return this.adviceService.confirmAdvice(id, dto, userId);
  }

  @Get('history')
  @ApiOperation({ summary: 'Xem toàn bộ lịch sử tư vấn dinh dưỡng đã gửi' })
  @Roles('NUTRITIONIST', 'TEACHER', 'PRINCIPAL', 'SUPER_ADMIN')
  async getAdviceHistory(@Query('studentId') studentId?: string) {
    return this.adviceService.getAdviceHistory(studentId ? Number(studentId) : undefined);
  }
}

