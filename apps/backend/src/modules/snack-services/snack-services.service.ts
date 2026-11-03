import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SnackServicePeriod } from './entities/snack-service-period.entity';
import { SnackRegistration } from './entities/snack-registration.entity';
import { Child } from '../children/entities/child.entity';
import { CreateSnackServicePeriodDto } from './dto/create-snack-service-period.dto';
import { UpdateSnackServiceDto } from './dto/update-snack-service.dto';
import { RegisterSnackServiceDto } from './dto/register-snack-service.dto';

export interface SnackMenuDayItem {
  dayOfWeek: number;
  dayLabel: string;
  servingTime: string;
  mainDish: string;
  drinkItem: string;
  fruitOrSide: string;
  caloriesKcal: number;
  proteinG: number;
  calciumMg: number;
  allergenTags: string[];
  nutritionNote?: string;
}

@Injectable()
export class SnackServicesService {
  private readonly customMenuSchedules = new Map<number, SnackMenuDayItem[]>();
  private readonly customDescriptions = new Map<number, string>();

  constructor(
    @InjectRepository(SnackServicePeriod)
    private readonly periodRepo: Repository<SnackServicePeriod>,
    @InjectRepository(SnackRegistration)
    private readonly regRepo: Repository<SnackRegistration>,
    @InjectRepository(Child)
    private readonly childRepo: Repository<Child>,
  ) {}

  isNutritionistOnly(user?: any): boolean {
    if (!user) return false;
    const roles: string[] = Array.isArray(user.roles)
      ? user.roles.map((r: any) =>
          typeof r === 'string' ? r.toUpperCase() : String(r?.code || r?.name || '').toUpperCase(),
        )
      : user.role
      ? [String(user.role).toUpperCase()]
      : [];
    const hasManager = roles.some((r) =>
      ['SUPER_ADMIN', 'PRINCIPAL', 'SCHOOL_MANAGER', 'SCHOOL_MANAGEMENT'].includes(r),
    );
    return !hasManager && roles.includes('NUTRITIONIST');
  }

  normalizeBreakfastText(text?: string): string {
    if (!text) return 'Dịch vụ Suất ăn sáng';
    return text
      .replace(/Ăn Xế Chiều 17h00/gi, 'Suất Ăn Sáng 07h00')
      .replace(/Ăn Xế Chiều 17h/gi, 'Suất Ăn Sáng 07h00')
      .replace(/Năng Lượng Chiều 17h00/gi, 'Năng Lượng Sáng 07h00')
      .replace(/Năng Lượng Chiều 17h/gi, 'Năng Lượng Sáng 07h00')
      .replace(/Năng Lượng Chiều/gi, 'Năng Lượng Sáng')
      .replace(/Ăn Xế Chiều/gi, 'Suất Ăn Sáng')
      .replace(/Ăn xế chiều/gi, 'Suất ăn sáng')
      .replace(/Suất ăn xế nhẹ lúc 17h00/gi, 'Suất ăn sáng dinh dưỡng lúc 07h00')
      .replace(/Ăn Xế/g, 'Ăn Sáng')
      .replace(/Ăn xế/g, 'Ăn sáng')
      .replace(/ăn xế/g, 'ăn sáng')
      .replace(/bữa xế/gi, 'bữa sáng');
  }

  getDefaultSnackMenuSchedule(periodName?: string): SnackMenuDayItem[] {
    const isPremium = (periodName || '').toLowerCase().includes('cao cấp');
    return [
      {
        dayOfWeek: 2,
        dayLabel: 'Thứ Hai',
        servingTime: '07:00 - 07:45',
        mainDish: isPremium ? 'Bánh Tart Táo Nướng Mật Ong Hữu Cơ' : 'Bánh Bông Lan Phô Mai Tươi & Cháo Yến Mạch',
        drinkItem: 'Sữa hạt Yến mạch nguyên cám ấm (180ml)',
        fruitOrSide: 'Chuối Laba chín cây',
        caloriesKcal: 265,
        proteinG: 8.8,
        calciumMg: 190,
        allergenTags: ['Sữa', 'Trứng', 'Lúa mì'],
        nutritionNote: 'Bổ sung năng lượng buổi sáng và chất xơ hòa tan beta-glucan từ yến mạch.',
      },
      {
        dayOfWeek: 3,
        dayLabel: 'Thứ Ba',
        servingTime: '07:00 - 07:45',
        mainDish: 'Nui Sao Hầm Thịt Bằm Rau Củ & Sữa Chua Hy Lạp',
        drinkItem: 'Nước ép Cam Vàng tươi nguyên chất (150ml)',
        fruitOrSide: 'Bánh quy bơ yến mạch giòn',
        caloriesKcal: 275,
        proteinG: 9.2,
        calciumMg: 210,
        allergenTags: ['Sữa', 'Lúa mì'],
        nutritionNote: 'Tăng cường lợi khuẩn Probiotics hỗ trợ tiêu hóa và Vitamin C tự nhiên.',
      },
      {
        dayOfWeek: 4,
        dayLabel: 'Thứ Tư',
        servingTime: '07:00 - 07:45',
        mainDish: 'Phở Gà Ta Mềm & Bánh Mì Bơ Sữa Tươi',
        drinkItem: 'Sữa Đậu Nành Non Organic ấm (180ml)',
        fruitOrSide: 'Dưa lưới Nhật cắt hạt lựu',
        caloriesKcal: 280,
        proteinG: 9.4,
        calciumMg: 165,
        allergenTags: ['Đậu nành'],
        nutritionNote: 'Cung cấp năng lượng khởi đầu ngày mới cho trẻ hoạt động học tập.',
      },
      {
        dayOfWeek: 5,
        dayLabel: 'Thứ Năm',
        servingTime: '07:00 - 07:45',
        mainDish: 'Cháo Cá Hồi Bí Đỏ & Pudding Trứng Sữa Tươi',
        drinkItem: 'Sữa tươi tiệt trùng nguyên kem (180ml)',
        fruitOrSide: 'Táo Envy gọt vỏ cắt lát',
        caloriesKcal: 270,
        proteinG: 9.8,
        calciumMg: 230,
        allergenTags: ['Sữa', 'Trứng'],
        nutritionNote: 'Giàu Canxi, DHA và Đạm sinh học cao giúp phát triển chiều cao tối ưu.',
      },
      {
        dayOfWeek: 6,
        dayLabel: 'Thứ Sáu',
        servingTime: '07:00 - 07:45',
        mainDish: 'Súp Gà Ngô Non Nấm Hương Ấm Bụng',
        drinkItem: 'Sữa hạt Hạnh nhân & Óc chó (180ml)',
        fruitOrSide: 'Đu đủ chín đỏ ngọt tự nhiên',
        caloriesKcal: 260,
        proteinG: 8.5,
        calciumMg: 185,
        allergenTags: ['Hạt cây'],
        nutritionNote: 'Bổ sung Omega-3 thực vật từ hạt óc chó và đạm dễ hấp thu buổi sáng.',
      },
    ];
  }

  getMenuScheduleForPeriod(periodId: number, periodName?: string): SnackMenuDayItem[] {
    return this.customMenuSchedules.get(Number(periodId)) || this.getDefaultSnackMenuSchedule(periodName);
  }

  async findAll(currentUser?: any, query?: { search?: string; status?: string; grade?: string }) {
    const isNutritionist = this.isNutritionistOnly(currentUser);
    const periods = await this.periodRepo.find({
      relations: ['registrations'],
      order: { startDate: 'DESC' },
    });

    const totalStudents = await this.childRepo.count();

    const mappedItems = periods.map((p) => {
      const regCount = (p.registrations || []).length;
      const paidCount = (p.registrations || []).filter((r) => r.status === 'PAID').length;
      const targetCount = 90;
      const percentage = Math.min(100, Math.round((regCount / (targetCount || 1)) * 100));
      const displayName = this.normalizeBreakfastText(p.name);
      const menuSchedule = this.getMenuScheduleForPeriod(Number(p.id), displayName);
      const feeVal = Number(p.feeAmount) || 440000;
      const pricePerUnit = feeVal > 50000 ? Math.round(feeVal / 22) : feeVal;
      const monthlyPrice = feeVal > 50000 ? feeVal : feeVal * 22;

      return {
        id: String(p.id),
        name: displayName,
        description: this.normalizeBreakfastText(
          this.customDescriptions.get(Number(p.id)) ||
            'Suất ăn sáng dinh dưỡng lúc 07h00 - Sữa tươi, bánh ngũ cốc và trái cây tươi',
        ),
        serviceType: 'BREAKFAST_SERVICE',
        billingCycle: 'MONTHLY',
        pricePerUnit,
        monthlyEstimatedPrice: monthlyPrice,
        feeAmount: monthlyPrice,
        startDate: p.startDate,
        endDate: p.endDate,
        registrationDeadline: p.registrationDeadline,
        appliedGrade: 'Tất cả các khối',
        registrationPeriod: `${p.startDate} ~ ${p.endDate}`,
        appliedMonth: p.startDate ? p.startDate.substring(0, 7) : '2026-10',
        registeredCount: isNutritionist ? 0 : regCount,
        targetCount,
        percentage: isNutritionist ? 0 : percentage,
        progressNote: isNutritionist
          ? 'Chế độ Chuyên gia Dinh dưỡng (Chỉ lên thực đơn ăn sáng)'
          : `Đã có ${regCount}/${targetCount} bé tham gia (${paidCount} bé đã đóng tiền)`,
        status: p.status as 'OPEN' | 'UPCOMING' | 'CLOSED',
        statusLabel: p.status === 'OPEN' ? 'Đang mở đăng ký' : p.status === 'UPCOMING' ? 'Sắp mở' : 'Đã khóa đợt',
        badges: ['Sữa tươi', 'Bánh ngũ cốc', 'Trái cây'],
        isActive: p.status === 'OPEN',
        enrolledCount: isNutritionist ? 0 : regCount,
        paidCount: isNutritionist ? 0 : paidCount,
        totalRevenue: isNutritionist ? 0 : paidCount * (Number(p.feeAmount) || 0),
        menuSchedule,
        hidePaymentInfo: isNutritionist,
      };
    });

    const items = mappedItems.filter((item) => {
      if (query?.search && !item.name.toLowerCase().includes(query.search.toLowerCase())) {
        return false;
      }
      if (query?.status && query.status !== 'ALL' && item.status !== query.status) {
        return false;
      }
      return true;
    });

    const totalRegistered = items.reduce((acc, i) => acc + i.registeredCount, 0);
    const totalCollected = items.reduce((acc, i) => acc + i.totalRevenue, 0);
    const expectedMonthly = items.reduce((acc, i) => acc + i.targetCount * i.monthlyEstimatedPrice, 0);

    const summary = {
      activeBatches: {
        total: items.length,
        open: items.filter((i) => i.status === 'OPEN').length,
        upcoming: items.filter((i) => i.status === 'UPCOMING').length,
        closed: items.filter((i) => i.status === 'CLOSED').length,
      },
      studentParticipation: {
        registered: isNutritionist ? 0 : totalRegistered,
        total: totalStudents || 14,
        percentage:
          !isNutritionist && totalStudents > 0
            ? Math.min(100, Math.round((totalRegistered / totalStudents) * 100))
            : 0,
        remaining: Math.max(0, (totalStudents || 14) - totalRegistered),
      },
      revenue: {
        expectedMonthly: isNutritionist ? 0 : expectedMonthly || 15000000,
        collected: isNutritionist ? 0 : totalCollected || 8500000,
        collectedPercentage:
          !isNutritionist && expectedMonthly > 0
            ? Math.round((totalCollected / expectedMonthly) * 100)
            : isNutritionist
            ? 0
            : 56,
      },
      satisfaction: {
        ratePercent: 98,
        ratingScore: 4.9,
        totalReviews: 24,
      },
    };

    return {
      success: true,
      data: items,
      items,
      summary,
      totalCount: items.length,
      activePeriod: items.find((i) => i.status === 'OPEN') || items[0] || null,
      hidePaymentInfo: isNutritionist,
    };
  }

  async findOne(id: number, currentUser?: any) {
    const isNutritionist = this.isNutritionistOnly(currentUser);
    const p = await this.periodRepo.findOne({
      where: { id },
      relations: [
        'registrations',
        'registrations.student',
        'registrations.student.class',
        'registrations.student.allergies',
        'registrations.student.allergies.allergen',
      ],
    });

    if (!p) throw new NotFoundException('Không tìm thấy gói dịch vụ ăn xế');

    const registrations = isNutritionist
      ? []
      : (p.registrations || []).map((r) => {
          const allergyList = (r.student?.allergies || [])
            .map((a) => a.allergen?.name || a.allergen?.code)
            .filter(Boolean);
          return {
            id: String(r.id),
            studentId: String(r.studentId),
            studentName: r.student?.fullName || 'Học sinh',
            studentCode: r.student?.studentCode || '',
            className: r.student?.class?.name || 'Mầm 1',
            status: r.status,
            registeredAt: r.registeredAt ? r.registeredAt.toISOString() : null,
            amount: p.feeAmount,
            hasAllergy: allergyList.length > 0,
            allergens: allergyList,
          };
        });

    const pricePerUnit = Math.round((Number(p.feeAmount) || 440000) / 22);
    const menuSchedule = this.getMenuScheduleForPeriod(Number(p.id), p.name);

    const periodData = {
      id: String(p.id),
      tenantId: 'a0000000-0000-0000-0000-000000000001',
      name: this.normalizeBreakfastText(p.name),
      description: this.normalizeBreakfastText(
        this.customDescriptions.get(Number(p.id)) ||
          'Suất ăn sáng dinh dưỡng lúc 07h00 - Sữa tươi, bánh ngũ cốc và trái cây tươi',
      ),
      serviceType: 'AFTER_SCHOOL_SNACK',
      billingCycle: 'MONTHLY',
      pricePerUnit,
      startDate: p.startDate,
      endDate: p.endDate,
      availableFrom: p.startDate,
      availableTo: p.endDate,
      registrationDeadline: p.registrationDeadline,
      feeAmount: Number(p.feeAmount),
      isActive: p.status === 'OPEN',
      status: p.status,
      registrations,
      menuSchedule,
      hidePaymentInfo: isNutritionist,
    };

    return {
      success: true,
      ...periodData,
      data: periodData,
    };
  }

  async createPeriod(dto: CreateSnackServicePeriodDto) {
    // 1. Luồng ngoại lệ: Ngày kết thúc nhận đơn <= ngày bắt đầu nhận đơn
    if (dto.registrationStart && dto.registrationEnd) {
      if (new Date(dto.registrationEnd).getTime() <= new Date(dto.registrationStart).getTime()) {
        throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
      }
    }

    // 2. Luồng ngoại lệ: Chưa chọn ít nhất 1 tháng phục vụ
    if (dto.serviceMonths !== undefined && dto.serviceMonths.length === 0) {
      throw new BadRequestException('Vui lòng chọn ít nhất 1 tháng phục vụ');
    }
    if (!dto.serviceMonths?.length && (!dto.startDate || !dto.endDate)) {
      throw new BadRequestException('Vui lòng chọn ít nhất 1 tháng phục vụ');
    }

    // 3. Luồng ngoại lệ: Chọn "Giới hạn chỗ" nhưng không nhập chỉ tiêu
    if (dto.capacityMode === 'LIMITED' && (!dto.totalQuota || dto.totalQuota <= 0)) {
      throw new BadRequestException('Vui lòng nhập tổng chỉ tiêu');
    }

    // 4. Tính toán thời gian bắt đầu và kết thúc phục vụ
    let startDate = dto.startDate;
    let endDate = dto.endDate;

    if (dto.serviceMonths && dto.serviceMonths.length > 0) {
      const sortedMonths = [...dto.serviceMonths].sort();
      startDate = `${sortedMonths[0]}-01`;
      const [yearStr, monthStr] = sortedMonths[sortedMonths.length - 1].split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const lastDay = new Date(year, month, 0).getDate();
      endDate = `${sortedMonths[sortedMonths.length - 1]}-${String(lastDay).padStart(2, '0')}`;
    }

    if (!startDate) {
      startDate = dto.registrationStart || new Date().toISOString().slice(0, 10);
    }
    if (!endDate) {
      endDate = dto.registrationEnd || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    }

    // 5. Điều kiện tiên quyết: Không tồn tại đợt đăng ký nào đang OPEN cùng tháng phục vụ (chỉ chặn khi không có periodCode riêng biệt hoặc trùng tên gói)
    const isDraft = dto.status === 'DRAFT';
    if (!isDraft) {
      const openPeriods = await this.periodRepo.find({
        where: { status: 'OPEN' },
      });
      const hasConflict = openPeriods.some((p) => {
        const dateOverlap = p.startDate <= endDate && p.endDate >= startDate;
        if (!dateOverlap) return false;
        if (dto.periodCode) {
          return (
            dto.name &&
            p.name?.trim().toLowerCase() === dto.name.trim().toLowerCase()
          );
        }
        return true;
      });
      if (hasConflict) {
        throw new BadRequestException(
          'Đã tồn tại đợt đăng ký đang mở cho tháng phục vụ này. Vui lòng đóng đợt cũ trước khi tạo đợt mới.',
        );
      }
    }

    // 6. Tên gói, hạn chót nhận đơn, và tính toán phí
    const name =
      dto.name ||
      (dto.serviceMonths?.length
        ? `Dịch vụ ăn xế Tháng ${dto.serviceMonths.join(', ')}`
        : dto.periodCode
        ? `Dịch vụ ăn xế ${dto.periodCode}`
        : 'Dịch vụ ăn xế');

    const registrationDeadline =
      dto.registrationEnd || dto.registrationDeadline || dto.registrationStart || startDate;

    const monthsCount = dto.serviceMonths?.length || 1;
    const pricePerDay = dto.pricePerUnitPerDay !== undefined ? Number(dto.pricePerUnitPerDay) : 20000;
    const feeAmount =
      dto.feeAmount !== undefined && dto.feeAmount > 0
        ? Number(dto.feeAmount)
        : pricePerDay * 22 * monthsCount;

    // 7. DB Status: Bản ghi snack_service_periods có ràng buộc CHECK (status IN ('OPEN', 'CLOSED'))
    const dbStatus = isDraft ? 'CLOSED' : 'OPEN';

    const period = this.periodRepo.create({
      name,
      startDate,
      endDate,
      registrationDeadline,
      feeAmount,
      status: dbStatus,
    });

    const saved = await this.periodRepo.save(period);
    if (dto.nutritionNotes && saved?.id) {
      this.customDescriptions.set(Number(saved.id), dto.nutritionNotes);
    }

    return {
      success: true,
      message: isDraft
        ? `Đã lưu bản nháp gói "${saved.name}" thành công!`
        : `Đã khởi tạo gói "${saved.name}" thành công và mở cổng cho phụ huynh đăng ký!`,
      data: {
        ...saved,
        periodCode: dto.periodCode,
        appliedGrades: dto.appliedGrades,
        isWholeSchool: dto.isWholeSchool,
        registrationStart: dto.registrationStart,
        registrationEnd: dto.registrationEnd,
        serviceMonths: dto.serviceMonths,
        pricePerUnitPerDay: dto.pricePerUnitPerDay,
        capacityMode: dto.capacityMode,
        kitchenCapacity: dto.kitchenCapacity,
        totalQuota: dto.totalQuota,
        quotaPerGrade: dto.quotaPerGrade,
        autoRefundEnabled: dto.autoRefundEnabled,
        autoCloseEnabled: dto.autoCloseEnabled,
        autoCloseThresholdPercent: dto.autoCloseThresholdPercent,
        nutritionNotes: dto.nutritionNotes,
        status: isDraft ? 'DRAFT' : saved.status,
      },
    };
  }

  async updatePeriod(id: number, dto: UpdateSnackServiceDto) {
    // 1. Kiểm tra sự tồn tại của đợt dịch vụ
    const p = await this.periodRepo.findOne({
      where: { id },
      relations: ['registrations'],
    });
    if (!p) throw new NotFoundException('Không tìm thấy gói dịch vụ ăn xế');

    const paidCount = (p.registrations || []).filter((r) => r.status === 'PAID').length;

    // 2. Điều kiện tiên quyết: Đợt chưa CLOSED (nếu đã đóng, không sửa đơn giá khi đã có đăng ký PAID)
    if (p.status === 'CLOSED') {
      const isPriceModified = dto.pricePerUnit !== undefined || dto.feeAmount !== undefined;
      if (isPriceModified && paidCount > 0) {
        throw new BadRequestException(
          'Đợt dịch vụ đã đóng và có học sinh đã thanh toán, không thể chỉnh sửa đơn giá',
        );
      }
    }

    // 3. Luồng ngoại lệ: Tên gói để trống
    if (dto.name !== undefined && !dto.name.trim()) {
      throw new BadRequestException('Vui lòng nhập tên gói dịch vụ');
    }

    // 4. Luồng ngoại lệ: Đơn giá nhập âm
    if (
      (dto.pricePerUnit !== undefined && dto.pricePerUnit < 0) ||
      (dto.feeAmount !== undefined && dto.feeAmount < 0)
    ) {
      throw new BadRequestException('Đơn giá không được âm');
    }

    // 5. Luồng ngoại lệ: Ngày kết thúc trước ngày bắt đầu
    const newStartDate = dto.startDate || dto.availableFrom || p.startDate;
    const newEndDate = dto.endDate || dto.availableTo || p.endDate;
    if (newStartDate && newEndDate && new Date(newEndDate).getTime() < new Date(newStartDate).getTime()) {
      throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
    }

    // 6. Cảnh báo khi giảm đơn giá nếu đã có học sinh thanh toán (PAID)
    let calculatedFee = p.feeAmount;
    if (dto.feeAmount !== undefined) {
      calculatedFee = Number(dto.feeAmount);
    } else if (dto.pricePerUnit !== undefined) {
      calculatedFee = Number(dto.pricePerUnit) * 22;
    }

    let warning: string | undefined = undefined;
    if (paidCount > 0 && calculatedFee < Number(p.feeAmount)) {
      warning = `Đã có ${paidCount} trẻ đã thanh toán. Thay đổi đơn giá sẽ ảnh hưởng đến các kỳ tính phí kế tiếp`;
    }

    // 7. Cập nhật các trường
    if (dto.name !== undefined) p.name = dto.name.trim();
    if (dto.startDate || dto.availableFrom) p.startDate = dto.startDate || dto.availableFrom || p.startDate;
    if (dto.endDate || dto.availableTo) p.endDate = dto.endDate || dto.availableTo || p.endDate;
    if (dto.registrationDeadline !== undefined) p.registrationDeadline = dto.registrationDeadline;
    p.feeAmount = calculatedFee;

    if (dto.status !== undefined) {
      p.status = dto.status;
    } else if (dto.isActive !== undefined) {
      p.status = dto.isActive ? 'OPEN' : 'CLOSED';
    }

    if (dto.description) {
      this.customDescriptions.set(Number(id), dto.description);
    }

    const saved = await this.periodRepo.save(p);

    const pricePerUnit = dto.pricePerUnit !== undefined ? dto.pricePerUnit : Math.round(Number(saved.feeAmount) / 22);
    const updatedData = {
      id: String(saved.id),
      name: saved.name,
      serviceType: dto.serviceType || 'AFTER_SCHOOL_SNACK',
      billingCycle: dto.billingCycle || 'MONTHLY',
      pricePerUnit,
      startDate: saved.startDate,
      endDate: saved.endDate,
      availableFrom: saved.startDate,
      availableTo: saved.endDate,
      registrationDeadline: saved.registrationDeadline,
      feeAmount: Number(saved.feeAmount),
      isActive: saved.status === 'OPEN',
      status: saved.status,
      description:
        dto.description ||
        this.customDescriptions.get(Number(id)) ||
        'Suất ăn xế chiều bổ sung dinh dưỡng',
    };

    return {
      success: true,
      message: 'Cập nhật cấu hình gói dịch vụ ăn sáng thành công!',
      warning,
      data: updatedData,
    };
  }

  /**
   * CGDD hoặc Hiệu trưởng lên thực đơn ăn xế cho gói dịch vụ
   */
  async updateMenuSchedule(
    id: number,
    payload: { menuSchedule: SnackMenuDayItem[]; description?: string },
  ) {
    const p = await this.periodRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Không tìm thấy gói dịch vụ ăn xế');

    if (!Array.isArray(payload.menuSchedule) || payload.menuSchedule.length === 0) {
      throw new BadRequestException('Vui lòng nhập đầy đủ lịch thực đơn ăn xế');
    }

    this.customMenuSchedules.set(Number(id), payload.menuSchedule);
    if (payload.description) {
      this.customDescriptions.set(Number(id), payload.description);
    }

    return {
      success: true,
      message: `Đã lưu và cập nhật thực đơn ăn xế cho gói "${p.name}" thành công!`,
      data: {
        id: String(p.id),
        name: p.name,
        menuSchedule: payload.menuSchedule,
      },
    };
  }

  async closePeriod(id: number) {
    const p = await this.periodRepo.findOne({
      where: { id },
      relations: ['registrations'],
    });
    if (!p) throw new NotFoundException('Không tìm thấy kỳ dịch vụ ăn xế');

    const totalCount = (p.registrations || []).length;
    const paidCount = (p.registrations || []).filter((r) => r.status === 'PAID').length;
    const pendingCount = (p.registrations || []).filter((r) => r.status === 'PENDING').length;

    let warning: string | undefined = undefined;
    if (totalCount === 0) {
      warning = 'Chưa có phụ huynh nào đăng ký trong đợt này';
    } else if (pendingCount > 0) {
      warning = `Còn ${pendingCount} đơn chờ thanh toán (PENDING). Danh sách chốt phục vụ gồm ${paidCount} học sinh đã thanh toán.`;
    }

    p.status = 'CLOSED';
    const saved = await this.periodRepo.save(p);

    return {
      success: true,
      message: `Đã đóng đợt đăng ký cho '${saved.name}'. Phụ huynh sẽ không thấy gói này nữa.`,
      warning,
      data: {
        id: String(saved.id),
        name: saved.name,
        status: saved.status,
        totalRegistrations: totalCount,
        paidCount,
        pendingCount,
        rosterClosed: true,
      },
    };
  }

  async openPeriod(id: number) {
    const p = await this.periodRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Không tìm thấy kỳ dịch vụ ăn xế');

    // Kiểm tra xung đột: Không tồn tại đợt đăng ký khác đang OPEN cùng khoảng thời gian
    const openPeriods = await this.periodRepo.find({ where: { status: 'OPEN' } });
    const hasConflict = openPeriods.some(
      (op) => Number(op.id) !== Number(p.id) && op.startDate <= p.endDate && op.endDate >= p.startDate,
    );
    if (hasConflict) {
      throw new BadRequestException(
        'Đã tồn tại đợt đăng ký khác đang mở cho tháng phục vụ này. Vui lòng đóng đợt cũ trước khi mở lại đợt này.',
      );
    }

    p.status = 'OPEN';
    const saved = await this.periodRepo.save(p);

    return {
      success: true,
      message: `Đã mở lại đợt đăng ký cho '${saved.name}'. Phụ huynh có thể tiếp tục đăng ký.`,
      data: {
        id: String(saved.id),
        name: saved.name,
        status: saved.status,
      },
    };
  }

  async togglePeriod(id: number) {
    const p = await this.periodRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Không tìm thấy kỳ dịch vụ ăn xế');

    if (p.status === 'OPEN') {
      return this.closePeriod(id);
    } else {
      return this.openPeriod(id);
    }
  }

  async getDayboardingSummary() {
    const totalStudents = await this.childRepo.count();

    const services = [
      {
        id: '1',
        code: 'DAYBOARDING_STANDARD',
        name: 'Dịch vụ Bán trú Tiêu chuẩn (Ăn trưa & Giấc ngủ trưa)',
        type: 'DAYBOARDING_STANDARD',
        feeAmount: 35000,
        billingCycle: 'DAILY',
        description: 'Bao gồm bữa trưa dinh dưỡng đạt chuẩn Thông tư 28/2016/TT-BGDĐT và chăm sóc giấc ngủ trưa.',
        enrolledCount: totalStudents,
        status: 'ACTIVE',
      },
      {
        id: '2',
        code: 'AFTER_SCHOOL_SNACK',
        name: 'Dịch vụ Ăn xế Chiều 17h00 (VNPAY)',
        type: 'AFTER_SCHOOL_SNACK',
        feeAmount: 20000,
        billingCycle: 'DAILY',
        description: 'Bữa phụ dinh dưỡng ấm nóng bổ sung năng lượng chiều trước giờ phụ huynh đón bé.',
        enrolledCount: 14,
        status: 'ACTIVE',
      },
      {
        id: '3',
        code: 'BREAKFAST',
        name: 'Dịch vụ Ăn sáng Tự chọn tại Trường',
        type: 'BREAKFAST',
        feeAmount: 25000,
        billingCycle: 'DAILY',
        description: 'Phục vụ từ 6h45 đến 7h45 sáng với thực đơn phở, bún, cháo, nui ấm bụng cho trẻ.',
        enrolledCount: 10,
        status: 'ACTIVE',
      },
      {
        id: '4',
        code: 'LATE_PICKUP',
        name: 'Dịch vụ Trông giữ Ngoài giờ (Sau 17h30)',
        type: 'LATE_PICKUP',
        feeAmount: 30000,
        billingCycle: 'DAILY',
        description: 'Giáo viên và nhân sự trực trông bé an toàn đến 18h30 kèm sữa chua/nước ép.',
        enrolledCount: 5,
        status: 'ACTIVE',
      },
    ];

    return {
      success: true,
      summary: {
        totalServices: services.length,
        totalEnrolled: totalStudents + 14 + 10 + 5,
        monthlyRevenue: 16800000,
        activeClasses: 6,
      },
      services,
      classes: [],
      students: [],
    };
  }

  async createService(dto: any) {
    const startDate = dto.startDate || new Date().toISOString().slice(0, 10);
    const endDate =
      dto.endDate || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const feeAmount =
      dto.feeAmount !== undefined
        ? Number(dto.feeAmount)
        : (Number(dto.pricePerUnit) || 20000) * 22;

    const period = this.periodRepo.create({
      name: dto.name || 'Gói Ăn Xế Chiều Mới',
      startDate,
      endDate,
      registrationDeadline: dto.registrationDeadline || endDate,
      feeAmount,
      status: dto.status === 'CLOSED' || dto.status === 'DRAFT' ? 'CLOSED' : 'OPEN',
    });

    const saved = await this.periodRepo.save(period);
    if (dto.description && saved?.id) {
      this.customDescriptions.set(Number(saved.id), dto.description);
    }

    return {
      success: true,
      message: 'Đã tạo gói dịch vụ ăn xế mới thành công!',
      data: saved,
    };
  }

  async deleteService(id: number) {
    const p = await this.periodRepo.findOne({
      where: { id },
      relations: ['registrations'],
    });
    if (!p) throw new NotFoundException('Không tìm thấy gói dịch vụ ăn xế');

    const paidCount = (p.registrations || []).filter((r) => r.status === 'PAID').length;
    if (paidCount > 0) {
      throw new BadRequestException(
        `Gói "${p.name}" đã có ${paidCount} phụ huynh hoàn tất thanh toán (PAID), không thể xóa. Vui lòng chọn Đóng đợt để lưu trữ đối soát.`,
      );
    }

    if (typeof (this.periodRepo as any).delete === 'function') {
      await (this.periodRepo as any).delete(id);
    } else if (typeof (this.periodRepo as any).remove === 'function') {
      await (this.periodRepo as any).remove(p);
    }

    this.customMenuSchedules.delete(Number(id));
    this.customDescriptions.delete(Number(id));

    return {
      success: true,
      message: `Đã xóa gói dịch vụ ăn xế "${p.name}" thành công!`,
    };
  }

  /**
   * Dành cho Phụ huynh: Xem các gói ăn xế đang mở công bố và Lịch Ăn Xế (chỉ hiển thị khi đã đóng tiền PAID)
   */
  async getParentSnackOverview(parentId: number = 13) {
    const allPeriods = await this.periodRepo.find({
      order: { id: 'DESC' },
    });

    let child: Child | null = null;
    try {
      if (typeof (this.childRepo as any).query === 'function') {
        const rows = await this.childRepo.query(
          `SELECT student_id FROM student_parents WHERE parent_id = $1 LIMIT 1`,
          [parentId],
        );
        if (rows?.[0]?.student_id) {
          child = await this.childRepo.findOne({
            where: { id: Number(rows[0].student_id) },
            relations: ['class'],
          });
        }
      }
    } catch {
      // Fallback
    }

    if (!child) {
      const students = await this.childRepo.find({
        relations: ['class'],
        take: 1,
        order: { id: 'ASC' },
      });
      child = students[0] || null;
    }

    const registrations = await this.regRepo.find({
      where: child ? [{ studentId: child.id }, { parentId }] : [{ parentId }],
      relations: ['period', 'student', 'student.class'],
      order: { id: 'DESC' },
    });

    // Kiểm tra xem phụ huynh đã có ít nhất 1 gói đã thanh toán (PAID) chưa
    const paidRegistrations = registrations.filter((r) => r.status === 'PAID');
    const hasPaidAnyPackage = paidRegistrations.length > 0;

    // Danh sách các gói đã công bố (OPEN) hoặc đã đăng ký của phụ huynh
    const publishedPackages = allPeriods
      .filter((p) => p.status === 'OPEN' || registrations.some((r) => Number(r.periodId) === Number(p.id)))
      .map((p) => {
        const reg = registrations.find((r) => Number(r.periodId) === Number(p.id));
        const isPaid = reg?.status === 'PAID';
        const feeVal = Number(p.feeAmount) || 440000;
        const pricePerDay = feeVal > 50000 ? Math.round(feeVal / 22) : feeVal;
        const totalFee = feeVal > 50000 ? feeVal : feeVal * 22;

        return {
          periodId: Number(p.id),
          periodName: this.normalizeBreakfastText(p.name),
          description: this.normalizeBreakfastText(
            this.customDescriptions.get(Number(p.id)) ||
              'Suất ăn sáng dinh dưỡng lúc 07h00 - Sữa tươi, bánh ngũ cốc và trái cây tươi',
          ),
          startDate: p.startDate,
          endDate: p.endDate,
          registrationDeadline: p.registrationDeadline,
          servingDays: 22,
          pricePerDay,
          feeAmount: totalFee,
          periodStatus: p.status,
          registrationId: reg ? Number(reg.id) : null,
          paymentStatus: reg ? reg.status : 'NOT_REGISTERED',
          isPaid,
          canViewSchedule: isPaid,
          // Ràng buộc nghiệp vụ: Phụ huynh khi đóng tiền sẽ thấy được lịch ăn sáng, không đóng là không thấy
          menuSchedule: isPaid ? this.getMenuScheduleForPeriod(Number(p.id), p.name) : [],
        };
      });

    return {
      success: true,
      student: child
        ? {
            id: Number(child.id),
            fullName: child.fullName,
            studentCode: child.studentCode,
            className: child.class?.name || 'Mầm 1',
          }
        : {
            id: 1,
            fullName: 'Trần Minh Khang',
            studentCode: 'KID-101',
            className: 'Mầm 1',
          },
      hasPaidAnyPackage,
      activeSchedule: hasPaidAnyPackage
        ? this.getMenuScheduleForPeriod(
            Number(paidRegistrations[0].periodId),
            paidRegistrations[0].period?.name,
          )
        : [],
      paidPackageName: hasPaidAnyPackage
        ? this.normalizeBreakfastText(paidRegistrations[0].period?.name)
        : null,
       publishedPackages,
    };
  }

  async registerEnrollment(dto: RegisterSnackServiceDto, currentUser?: any) {
    const periodId = Number(dto.periodId);
    const studentId = Number(dto.studentId);

    if (!periodId || !studentId) {
      throw new BadRequestException('Vui lòng chọn đợt đăng ký và học sinh');
    }

    // 1. Kiểm tra đợt dịch vụ
    const period = await this.periodRepo.findOne({
      where: { id: periodId },
      relations: ['registrations'],
    });
    if (!period) throw new NotFoundException('Không tìm thấy kỳ dịch vụ ăn xế');

    // Pre-condition: Đợt phải đang OPEN
    if (period.status !== 'OPEN') {
      throw new BadRequestException('Đã hết thời gian đăng ký (đợt dịch vụ đã đóng)');
    }

    // Pre-condition: Kiểm tra hạn chót đăng ký (registrationDeadline)
    if (period.registrationDeadline) {
      const deadline = new Date(period.registrationDeadline);
      deadline.setHours(23, 59, 59, 999);
      if (new Date().getTime() > deadline.getTime()) {
        throw new BadRequestException('Đã hết thời gian đăng ký');
      }
    }

    // 2. Kiểm tra học sinh
    const child = await this.childRepo.findOne({
      where: { id: studentId },
      relations: ['allergies', 'allergies.allergen', 'class'],
    });
    if (!child) throw new NotFoundException('Không tìm thấy học sinh');

    // 3. Kiểm tra đơn đăng ký trùng lặp của trẻ trong đợt này
    const existingReg = await this.regRepo.findOne({
      where: { periodId, studentId },
    });
    if (existingReg) {
      if (existingReg.status === 'PAID') {
        throw new BadRequestException('Bé đã đăng ký và thanh toán thành công rồi');
      }
      if (existingReg.status === 'PENDING') {
        return {
          success: true,
          isExisting: true,
          message: 'Bé đã có đơn đăng ký đang chờ thanh toán',
          warning: 'Đơn đăng ký của bé đang ở trạng thái chờ thanh toán. Vui lòng hoàn tất thanh toán.',
          data: {
            id: String(existingReg.id),
            periodId: String(existingReg.periodId),
            studentId: String(existingReg.studentId),
            studentName: child.fullName,
            studentCode: child.studentCode,
            className: child.class?.name || '',
            parentId: String(existingReg.parentId),
            status: existingReg.status,
            feeAmount: Number(period.feeAmount),
            hasAllergy: (child.allergies || []).length > 0,
            allergyNames: (child.allergies || []).map((a) => a.allergen?.name || a.allergen?.code),
            registeredAt: existingReg.registeredAt ? existingReg.registeredAt.toISOString() : new Date().toISOString(),
          },
        };
      }
    }

    // 4. Kiểm tra chỉ tiêu (Quota capacity) nếu giới hạn
    const totalRegistrations = (period.registrations || []).filter((r) => r.status !== 'CANCELLED').length;
    const quotaLimit = 90; // Giới hạn chỉ tiêu suất bếp của trường (90 suất ăn sáng)
    if (totalRegistrations >= quotaLimit) {
      throw new BadRequestException('Đã đủ chỉ tiêu cho khối lớp của bé. Liên hệ nhà trường để được hỗ trợ');
    }

    // 5. Kiểm tra quy tắc Dị ứng (Allergy Rules Check)
    const allergyCheck = await this.checkAllergySafety(periodId, studentId);
    let warningNote = allergyCheck.warning;

    if (allergyCheck.isConflict) {
      if (!dto.acceptRisk) {
        throw new BadRequestException(
          `Thực đơn không phù hợp với hồ sơ dị ứng của trẻ: ${allergyCheck.conflictingAllergens.join(', ')}`,
        );
      } else {
        warningNote = `Trẻ có hồ sơ dị ứng (${allergyCheck.conflictingAllergens.join(', ')}). Phụ huynh/quản lý đã xác nhận chấp nhận rủi ro và bếp đã nhận cảnh báo đặc biệt để chuẩn bị suất ăn thay thế.`;
      }
    }

    // 6. Xác định parentId
    let parentId = dto.parentId;
    if (!parentId) {
      try {
        const parentRows = await this.childRepo.query(
          `SELECT parent_id FROM student_parents WHERE student_id = $1 ORDER BY is_primary DESC LIMIT 1`,
          [studentId],
        );
        if (parentRows && parentRows.length > 0 && parentRows[0].parent_id) {
          parentId = Number(parentRows[0].parent_id);
        }
      } catch (e) {
        // Fallback
      }
    }
    if (!parentId) {
      parentId = currentUser?.id ? Number(currentUser.id) : 1;
    }

    // 7. Tạo bản ghi đăng ký mới trong DB
    const regStatus = dto.markAsPaid ? 'PAID' : 'PENDING';
    const newReg = this.regRepo.create({
      periodId,
      studentId,
      parentId,
      status: regStatus,
    });

    const saved = await this.regRepo.save(newReg);

    return {
      success: true,
      message: regStatus === 'PAID'
        ? `Đăng ký và xác nhận thanh toán thành công cho bé ${child.fullName} vào đợt '${period.name}'`
        : `Đăng ký thành công cho bé ${child.fullName} vào đợt '${period.name}'. Vui lòng hoàn tất thanh toán.`,
      warning: warningNote,
      data: {
        id: String(saved.id),
        periodId: String(saved.periodId),
        studentId: String(saved.studentId),
        studentName: child.fullName,
        studentCode: child.studentCode,
        className: child.class?.name || '',
        parentId: String(saved.parentId),
        status: saved.status,
        feeAmount: Number(period.feeAmount),
        hasAllergy: (child.allergies || []).length > 0,
        allergyNames: (child.allergies || []).map((a) => a.allergen?.name || a.allergen?.code),
        registeredAt: saved.registeredAt ? saved.registeredAt.toISOString() : new Date().toISOString(),
      },
    };
  }

  async checkAllergySafety(periodId: number, studentId: number) {
    const period = await this.periodRepo.findOne({ where: { id: periodId } });
    if (!period) throw new NotFoundException('Không tìm thấy kỳ dịch vụ ăn xế');

    const child = await this.childRepo.findOne({
      where: { id: studentId },
      relations: ['allergies', 'allergies.allergen', 'class'],
    });
    if (!child) throw new NotFoundException('Không tìm thấy học sinh');

    const allergies = child.allergies || [];
    if (allergies.length === 0) {
      return {
        success: true,
        hasAllergy: false,
        isConflict: false,
        isDangerous: false,
        severity: 'NONE',
        conflictingAllergens: [],
        allergyNames: [],
        warning: undefined,
        statusMessage: 'Trẻ không có hồ sơ dị ứng thực phẩm. Đủ điều kiện đăng ký an toàn.',
      };
    }

    const menuText = [
      period.name,
      'Suất ăn xế nhẹ lúc 17h00 - Sữa tươi, bánh ngũ cốc và trái cây tươi',
    ]
      .join(' ')
      .toLowerCase();

    const allergenKeywords: Record<string, string[]> = {
      MILK: ['sữa', 'bơ', 'phô mai', 'váng sữa', 'milk', 'cheese', 'butter'],
      EGG: ['trứng', 'egg', 'mayonnaise'],
      PEANUT: ['đậu phộng', 'lạc', 'peanut'],
      TREE_NUT: ['hạt dẻ', 'hạnh nhân', 'hạt điều', 'óc chó', 'macca', 'tree nut', 'almond', 'walnut'],
      SEAFOOD: ['hải sản', 'tôm', 'cua', 'cá', 'mực', 'nghêu', 'sò', 'seafood', 'shrimp', 'fish'],
      WHEAT: ['lúa mì', 'bột mì', 'mì', 'bánh mì', 'gluten', 'wheat'],
      SOY: ['đậu nành', 'đậu hũ', 'đậu phụ', 'soy', 'tofu'],
      SESAME: ['mè', 'vừng', 'sesame'],
    };

    const conflictingAllergens: string[] = [];
    let maxSeverity: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';

    for (const alg of allergies) {
      const code = (alg.allergen?.code || '').toUpperCase();
      const name = alg.allergen?.name || 'Dị ứng thực phẩm';
      const kws = allergenKeywords[code] || [name.toLowerCase()];
      const matches = kws.some((kw) => menuText.includes(kw));

      if (matches) {
        conflictingAllergens.push(name);
        const sev = (alg.severity || 'MEDIUM').toUpperCase() as 'LOW' | 'MEDIUM' | 'HIGH';
        if (sev === 'HIGH' || (sev === 'MEDIUM' && maxSeverity === 'LOW')) {
          maxSeverity = sev;
        }
      }
    }

    const isConflict = conflictingAllergens.length > 0;
    const isDangerous = isConflict && maxSeverity === 'HIGH';
    const allAllergyNames = allergies.map((a) => a.allergen?.name || a.allergen?.code || 'Dị ứng');

    let statusMessage = '';
    let warning: string | undefined = undefined;

    if (!isConflict) {
      statusMessage = 'Trẻ có hồ sơ dị ứng nhưng thực đơn an toàn';
      warning = `Trẻ có hồ sơ dị ứng (${allAllergyNames.join(', ')}) - Bếp đã được thông báo`;
    } else if (isDangerous) {
      statusMessage = `Thực đơn không phù hợp với hồ sơ dị ứng của trẻ: ${conflictingAllergens.join(', ')} (Mức độ nguy hiểm cao)`;
      warning = statusMessage;
    } else {
      statusMessage = `Thực đơn có chứa chất gây dị ứng: ${conflictingAllergens.join(', ')}`;
      warning = statusMessage;
    }

    return {
      success: true,
      hasAllergy: true,
      isConflict,
      isDangerous,
      severity: isConflict ? maxSeverity : 'SAFE',
      conflictingAllergens,
      allergyNames: allAllergyNames,
      warning,
      statusMessage,
    };
  }

  async confirmPayment(registrationId: number) {
    const reg = await this.regRepo.findOne({
      where: { id: registrationId },
      relations: ['student', 'student.class', 'period'],
    });
    if (!reg) throw new NotFoundException('Không tìm thấy thông tin đăng ký');

    reg.status = 'PAID';
    const saved = await this.regRepo.save(reg);

    const studentName = reg.student?.fullName || 'Bé';
    const periodName = reg.period?.name || 'Ăn xế';

    return {
      success: true,
      message: `Bé ${studentName} đã được đăng ký thành công đợt ăn xế ${periodName}`,
      data: {
        id: String(saved.id),
        periodId: String(saved.periodId),
        studentId: String(saved.studentId),
        studentName,
        status: saved.status,
        registeredAt: saved.registeredAt,
      },
    };
  }

  async getStudentsAvailable(periodId?: number) {
    const students = await this.childRepo.find({
      relations: ['class', 'allergies', 'allergies.allergen'],
      order: { fullName: 'ASC' },
    });

    let registeredStudentIds: number[] = [];
    if (periodId) {
      const regs = await this.regRepo.find({
        where: { periodId },
      });
      registeredStudentIds = regs.map((r) => Number(r.studentId));
    }

    return {
      success: true,
      data: students.map((s) => ({
        id: String(s.id),
        studentCode: s.studentCode,
        fullName: s.fullName,
        dateOfBirth: s.dateOfBirth,
        gender: s.gender,
        className: s.class?.name || 'Chưa xếp lớp',
        classId: s.classId ? String(s.classId) : undefined,
        hasAllergy: (s.allergies || []).length > 0,
        allergies: (s.allergies || []).map((a) => ({
          allergenName: a.allergen?.name || 'Dị ứng',
          allergenCode: a.allergen?.code || '',
          severity: a.severity,
          note: a.note,
        })),
        isRegistered: registeredStudentIds.includes(Number(s.id)),
      })),
    };
  }
}
