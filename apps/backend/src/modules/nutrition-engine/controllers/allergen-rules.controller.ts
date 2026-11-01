import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AllergenRulesService } from '../services/allergen-rules.service';
import { CreateAllergenDto } from '../dto/create-allergen.dto';
import { UpdateAllergenDto } from '../dto/update-allergen.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Nutrition Engine - Allergens')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('allergens')
export class AllergenRulesController {
  constructor(private readonly allergensService: AllergenRulesService) {}

  @Get()
  findAll(@Query() query: any) {
    return this.allergensService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.allergensService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateAllergenDto) {
    return this.allergensService.create(dto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAllergenDto) {
    return this.allergensService.update(id, dto);
  }

  @Patch(':id/status')
  toggleStatus(@Param('id', ParseIntPipe) id: number, @Body() body: { isActive?: boolean }) {
    return this.allergensService.toggleStatus(id, body?.isActive);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.allergensService.remove(id);
  }

  @Patch(':id/restore')
  restore(@Param('id', ParseIntPipe) id: number) {
    return this.allergensService.restore(id);
  }
}
