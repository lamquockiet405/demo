import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ParentEvaluation, EvaluationReply } from '../entities/parent-evaluation.entity';
import { Child } from '../../children/entities/child.entity';
import { DailyMealAttendance } from '../../attendance/entities/daily-meal-attendance.entity';
import { ParentEvaluationQueryParams } from '../dto/parent-evaluation-query.dto';
import { RespondEvaluationPayload } from '../dto/respond-parent-evaluation.dto';
import { SubmitEvaluationDto } from '../dto/submit-evaluation.dto';
import { ClassEntity } from '../../classes/entities/class.entity';
import { Dish } from '../../dishes/entities/dish.entity';
import {
  QueryParentEvaluationSummaryDto,
  ParentEvaluationSummaryReport,
  OverallCsatSummary,
  QualityDimensionAnalysis,
  DishPopularityRanking,
  DishRankingItem,
  SlaPerformanceOverview,
  SlaPerformanceItem,
  GradeCsatBreakdown,
  RecipeImprovementRecord,
} from '../dto/query-parent-evaluation-summary.dto';
import { RespondSpecialistDto } from '../dto/respond-specialist.dto';
import { CreateRecipeImprovementLogDto } from '../dto/create-recipe-improvement-log.dto';
import { MenusService } from '../../menus/services/menus.service';

@Injectable()
export class ParentEvaluationService {
  private recipeImprovementLogs: RecipeImprovementRecord[] = [
    {
      id: 1,
      dishId: 101,
      dishName: 'Canh rau dền đỏ nấu tôm đồng',
      issueFeedback: 'Phụ huynh phản ánh canh quá mặn, vượt chuẩn natri cho lứa tuổi mầm non',
      actionPlan: 'Bắt buộc giảm 30% lượng muối, kiểm tra bằng bút đo độ mặn trước khi chia suất',
      priority: 'HIGH',
      createdByRole: 'NUTRITIONIST',
      createdByName: 'ThS.BS Dinh dưỡng Lê Hoàng Mai',
      createdAt: new Date().toISOString(),
      status: 'ASSIGNED_TO_CHEF',
    },
    {
      id: 2,
      dishId: 102,
      dishName: 'Thịt heo viên sốt cà chua',
      issueFeedback: 'Viên thịt còn khô cứng, các bé 24-36 tháng khó nhai nuốt',
      actionPlan: 'Bổ sung mộc nhĩ nấm hương băm nhuyễn và hấp cách thủy tăng độ mềm ẩm',
      priority: 'CRITICAL',
      createdByRole: 'NUTRITIONIST',
      createdByName: 'ThS.BS Dinh dưỡng Lê Hoàng Mai',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      status: 'IN_PROGRESS',
    },
    {
      id: 3,
      dishId: 103,
      dishName: 'Chè đậu đỏ nước cốt dừa',
      issueFeedback: 'Chè hơi ngọt gắt, phụ huynh lo ngại ảnh hưởng men răng và đường huyết',
      actionPlan: 'Cắt giảm 25% đường, thay thế bằng đường thốt nốt thanh nhẹ',
      priority: 'NORMAL',
      createdByRole: 'NUTRITIONIST',
      createdByName: 'ThS.BS Dinh dưỡng Lê Hoàng Mai',
      createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      status: 'COMPLETED',
    },
  ];
  constructor(
    @InjectRepository(ParentEvaluation)
    private readonly evalRepo: Repository<ParentEvaluation>,
    @InjectRepository(EvaluationReply)
    private readonly replyRepo: Repository<EvaluationReply>,
    @InjectRepository(Child)
    private readonly childRepo: Repository<Child>,
    @InjectRepository(DailyMealAttendance)
    private readonly attendanceRepo: Repository<DailyMealAttendance>,
    @Optional()
    @InjectRepository(ClassEntity)
    private readonly classRepo?: Repository<ClassEntity>,
    @Optional()
    @InjectRepository(Dish)
    private readonly dishRepo?: Repository<Dish>,
    private readonly menusService?: MenusService,
  ) {}


  private mapToItem(evalEntity: ParentEvaluation) {
    const student = evalEntity.student;
    const sortedReplies = evalEntity.replies
      ? [...evalEntity.replies].sort(
          (a, b) => new Date(b.repliedAt).getTime() - new Date(a.repliedAt).getTime(),
        )
      : [];
    const hasReplies = sortedReplies.length > 0;
    const latestReply = hasReplies ? sortedReplies[0] : null;

    const status = hasReplies ? 'RESPONDED' : 'PENDING';
    const statusLabel = hasReplies ? 'Đã phản hồi' : 'Chờ phản hồi';

    return {
      id: String(evalEntity.id),
      tenantId: student?.class?.schoolId ? String(student.class.schoolId) : '1',
      parentId: '1',
      childId: String(evalEntity.studentId),
      feedbackDate: evalEntity.createdAt ? evalEntity.createdAt.toISOString().split('T')[0] : '',
      mealType: 'TRUA',
      mealTitle: evalEntity.menu
        ? `Thực đơn ${evalEntity.menu.ageGroup || 'Mẫu giáo'}`
        : 'Bữa trưa dinh dưỡng',
      rating: evalEntity.rating,
      title: `Đánh giá bữa ăn - ${student?.fullName || 'Bé'}`,
      content: evalEntity.comment || '',
      status: status as 'PENDING' | 'RESPONDED' | 'RESOLVED',
      statusLabel,
      parentRelation: 'Phụ huynh',
      parentNameCustom: student ? `Phụ huynh bé ${student.fullName}` : 'Phụ huynh',
      childNameCustom: student?.fullName || '',
      classNameCustom: student?.class?.name || '',
      gradeLevelCustom: student?.class?.ageGroup === 'NHA_TRE' ? 'Nhà trẻ' : 'Mẫu giáo',
      feedbackTimeLabel: evalEntity.createdAt
        ? new Date(evalEntity.createdAt).toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
          })
        : '',
      priorityNote: evalEntity.rating <= 2 ? 'Cần xử lý gấp' : undefined,
      likesInfo: '0',
      photos: [],
      photoDetails: [],
      responseContent: latestReply ? latestReply.content : undefined,
      responseHeader: latestReply ? 'Phản hồi từ Nhà trường' : undefined,
      respondedBy: latestReply ? String(latestReply.repliedBy) : undefined,
      respondedByName: latestReply?.user?.fullName || (hasReplies ? 'Ban Giám Hiệu' : undefined),
      respondedAt: latestReply ? latestReply.repliedAt.toISOString() : undefined,
      pushNotificationSent: true,
      isDrafting: false,
      displayOrder: 1,
      createdAt: evalEntity.createdAt ? evalEntity.createdAt.toISOString() : '',
      updatedAt: evalEntity.createdAt ? evalEntity.createdAt.toISOString() : '',
    };
  }

  async getEvaluations(params: ParentEvaluationQueryParams, schoolId?: number) {
    const qb = this.evalRepo
      .createQueryBuilder('eval')
      .leftJoinAndSelect('eval.student', 'student')
      .leftJoinAndSelect('student.class', 'class')
      .leftJoinAndSelect('eval.menu', 'menu')
      .leftJoinAndSelect('eval.replies', 'replies')
      .leftJoinAndSelect('replies.user', 'user');

    if (schoolId) {
      qb.andWhere('class.schoolId = :schoolId', { schoolId });
    }

    if (params.search) {
      qb.andWhere(
        '(eval.comment ILIKE :search OR student.fullName ILIKE :search)',
        { search: `%${params.search}%` },
      );
    }

    if (params.rating) {
      qb.andWhere('eval.rating = :rating', { rating: params.rating });
    }

    if (params.className) {
      qb.andWhere('class.name ILIKE :cName', { cName: `%${params.className}%` });
    }

    if (params.status && params.status !== 'ALL') {
      if (params.status === 'PENDING') {
        qb.andWhere(
          'NOT EXISTS (SELECT 1 FROM evaluation_replies er WHERE er.evaluation_id = eval.id)',
        );
      } else if (params.status === 'RESPONDED') {
        qb.andWhere(
          'EXISTS (SELECT 1 FROM evaluation_replies er WHERE er.evaluation_id = eval.id)',
        );
      } else if (params.status === 'HAS_PHOTO') {
        qb.andWhere('1 = 0');
      }
    }

    const sortBy = params.sortBy || 'NEWEST';
    switch (sortBy) {
      case 'OLDEST':
        qb.orderBy('eval.createdAt', 'ASC');
        break;
      case 'RATING_HIGH':
      case 'RATING_DESC':
        qb.orderBy('eval.rating', 'DESC').addOrderBy('eval.createdAt', 'DESC');
        break;
      case 'RATING_LOW':
      case 'RATING_ASC':
        qb.orderBy('eval.rating', 'ASC').addOrderBy('eval.createdAt', 'DESC');
        break;
      case 'NEWEST':
      default:
        qb.orderBy('eval.createdAt', 'DESC');
        break;
    }

    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, params.limit || 20);
    qb.skip((page - 1) * limit).take(limit);

    const [allEvals, total] = await qb.getManyAndCount();

    // Summary stats from DB
    const allTotal = await this.evalRepo.count();
    const allRatings = await this.evalRepo
      .createQueryBuilder('e')
      .select('AVG(e.rating)', 'avg')
      .addSelect('COUNT(*)', 'total')
      .getRawOne();

    const avgRating = allRatings?.avg ? Math.round(Number(allRatings.avg) * 10) / 10 : 5.0;
    const positiveCount = await this.evalRepo
      .createQueryBuilder('e')
      .where('e.rating >= 4')
      .getCount();
    const positiveRate = allTotal > 0 ? Math.round((positiveCount / allTotal) * 100) : 100;

    const respondedCount = await this.replyRepo
      .createQueryBuilder('r')
      .select('COUNT(DISTINCT r.evaluation_id)', 'count')
      .getRawOne();
    const respCount = respondedCount?.count ? Number(respondedCount.count) : 0;
    const pendingCount = Math.max(0, allTotal - respCount);

    // Pending classes count
    const pendingClassesRaw = await this.evalRepo
      .createQueryBuilder('e')
      .leftJoin('e.student', 's')
      .where('NOT EXISTS (SELECT 1 FROM evaluation_replies er WHERE er.evaluation_id = e.id)')
      .andWhere('s.classId IS NOT NULL')
      .select('COUNT(DISTINCT s.classId)', 'count')
      .getRawOne();
    const pendingClassesCount = pendingClassesRaw?.count ? Number(pendingClassesRaw.count) : 0;

    // Average response time
    const avgResponseTimeRaw = await this.evalRepo.query(`
      SELECT AVG(EXTRACT(EPOCH FROM (r.replied_at - e.created_at))) as avg_seconds
      FROM evaluation_replies r
      INNER JOIN parent_evaluations e ON e.id = r.evaluation_id
    `);
    let avgResponseTime = '0.5 giờ';
    if (avgResponseTimeRaw && avgResponseTimeRaw[0]?.avg_seconds != null) {
      const avgHours = Math.round((Number(avgResponseTimeRaw[0].avg_seconds) / 3600) * 10) / 10;
      avgResponseTime = `${avgHours} giờ`;
    }

    return {
      items: allEvals.map((e) => this.mapToItem(e)),
      pagination: {
        totalItems: total,
        currentPage: page,
        pageSize: limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
      summaryStats: {
        totalCount: allTotal,
        avgRating,
        positiveRate,
        pendingCount,
        respondedCount: respCount,
        photosCount: 0,
        pendingClassesCount,
        avgResponseTime,
      },
    };
  }

  async respondToEvaluation(id: number, payload: RespondEvaluationPayload, userId: number) {
    const evalEntity = await this.evalRepo.findOne({
      where: { id },
      relations: ['student', 'student.class', 'menu', 'replies', 'replies.user'],
    });
    if (!evalEntity) {
      throw new NotFoundException(`Parent evaluation #${id} not found`);
    }

    let reply = await this.replyRepo.findOne({
      where: { evaluationId: id },
    });

    if (reply) {
      reply.content = payload.responseContent;
      reply.repliedBy = userId;
      reply.repliedAt = new Date();
      await this.replyRepo.save(reply);
    } else {
      reply = this.replyRepo.create({
        evaluationId: id,
        repliedBy: userId,
        content: payload.responseContent,
      });
      await this.replyRepo.save(reply);
    }

    const updatedEval = await this.evalRepo.findOne({
      where: { id },
      relations: ['student', 'student.class', 'menu', 'replies', 'replies.user'],
    });

    return this.mapToItem(updatedEval || evalEntity);
  }

  async updateResponse(id: number, payload: RespondEvaluationPayload, userId: number) {
    return this.respondToEvaluation(id, payload, userId);
  }

  async toggleDraft(id: number, isDrafting: boolean) {
    const evalEntity = await this.evalRepo.findOne({
      where: { id },
      relations: ['student', 'student.class', 'menu', 'replies', 'replies.user'],
    });
    if (!evalEntity) {
      throw new NotFoundException(`Parent evaluation #${id} not found`);
    }

    const item = this.mapToItem(evalEntity);
    item.isDrafting = isDrafting;
    return item;
  }

  async getPortalData(childId?: string, userId?: number) {
    let student: Child | null = null;
    if (childId) {
      student = await this.childRepo.findOne({
        where: { id: Number(childId) },
        relations: ['class', 'allergies', 'allergies.allergen'],
      });
    }

    if (!student) {
      const [first] = await this.childRepo.find({
        take: 1,
        relations: ['class', 'allergies', 'allergies.allergen'],
      });
      student = first || null;
    }

    const allergyNames = student?.allergies && student.allergies.length > 0
      ? student.allergies.map((a) => a.allergen?.name || 'Dị ứng').join(', ')
      : 'Không';

    const childProfile = student
      ? {
          id: String(student.id),
          name: student.fullName,
          age: 4,
          className: student.class?.name || 'Lớp Mầm 1',
          gradeLevel: student.class?.ageGroup === 'NHA_TRE' ? 'Nhà trẻ' : 'Mẫu giáo (4–5T)',
          weight: 16.5,
          height: 104.2,
          allergyWarning: allergyNames,
          parentName: `Phụ huynh bé ${student.fullName}`,
          parentRole: 'Mẹ bé',
        }
      : {
          id: '1',
          name: 'Bé Nguyễn Bảo Nam',
          age: 4,
          className: 'Lớp Mầm 1',
          gradeLevel: 'Mẫu giáo (4–5T)',
          weight: 16.5,
          height: 104.2,
          allergyWarning: 'Không',
          parentName: 'Chị Hoàng Yến',
          parentRole: 'Mẹ bé Bảo Nam',
        };

    const recentEvaluations = student
      ? await this.evalRepo.find({
          where: { studentId: student.id },
          relations: ['student', 'student.class', 'menu', 'replies', 'replies.user'],
          order: { createdAt: 'DESC' },
          take: 5,
        })
      : [];

    return {
      child: childProfile,
      childProfile,
      todayMeal: {
        dateLabel: `Thứ Ba, ${new Date().toLocaleDateString('vi-VN')}`,
        timeLabel: '10:45 - 11:30',
        session: 'Bữa trưa',
        mealType: 'TRUA',
        title: 'Bữa trưa dinh dưỡng tiêu chuẩn',
        calories: '540 kcal',
        dishes: [
          { name: 'Thịt bò xào rau củ', dishType: 'MAIN', calories: '210 kcal' },
          { name: 'Canh bí đỏ thịt bằm', dishType: 'SOUP', calories: '120 kcal' },
          { name: 'Cơm trắng', dishType: 'RICE', calories: '150 kcal' },
          { name: 'Chuối tiêu', dishType: 'DESSERT', calories: '60 kcal' },
        ],
        allergyControl: 'Không chứa đậu phộng, hải sản dị ứng',
        nutritionStandard: {
          title: 'Dinh dưỡng chuẩn viện dinh dưỡng quốc gia',
          subtitle: 'Tổng năng lượng bữa trưa đạt 580 kcal • Protein: 22g • Canxi: 210mg • Chất xơ: 6.5g',
          calories: 580,
          protein: '22g',
          calcium: '210mg',
          fiber: '6.5g',
        },
      },
      stats: {
        satisfactionRating: 4.9,
        maxRating: 5.0,
        totalReviewsCount: recentEvaluations.length || 18,
        responseRatePercent: 100,
        responseTimeNote: 'Phản hồi trong 2 giờ',
        responseTimeSubtitle: 'Tiếp nhận & giải trình minh bạch',
        totalEvaluated: recentEvaluations.length,
        avgRating: 4.9,
        lovedDishesCount: 14,
      },
      history: recentEvaluations.map((e) => this.mapToItem(e)),
      recentEvaluations: recentEvaluations.map((e) => this.mapToItem(e)),
    };
  }

  async submitEvaluation(payload: SubmitEvaluationDto, userId?: number) {
    const studentId = Number(payload.studentId || payload.childId || 1);
    const comment = payload.content || payload.comment || payload.title || 'Đánh giá tốt';

    const evaluation = this.evalRepo.create({
      studentId,
      menuId: payload.menuId ? Number(payload.menuId) : null,
      rating: payload.rating || 5,
      comment,
    });

    const saved = await this.evalRepo.save(evaluation);

    return {
      success: true,
      message: 'Gửi đánh giá bữa ăn thành công',
      data: {
        id: String(saved.id),
        studentId: saved.studentId,
        rating: saved.rating,
        comment: saved.comment,
      },
    };
  }

  async getChildMenuConsumption(childId?: string, date?: string) {
    const sId = Number(childId || 1);
    const targetDate = date || new Date().toISOString().split('T')[0];

    
    let student = await this.childRepo.findOne({
      where: { id: sId },
      relations: ['class', 'allergies', 'allergies.allergen'],
    });

    if (!student) {
      const [first] = await this.childRepo.find({
        take: 1,
        relations: ['class', 'allergies', 'allergies.allergen'],
      });
      student = first || null;
    }

    const allergyNames = student?.allergies && student.allergies.length > 0
      ? student.allergies.map((a) => a.allergen?.name || 'Dị ứng').join(', ')
      : '';

    const child = student
      ? {
          id: String(student.id),
          name: student.fullName,
          age: 4,
          className: student.class?.name || 'Lớp Mầm 1',
          gradeLevel: student.class?.ageGroup === 'NHA_TRE' ? 'Nhà trẻ' : 'Mẫu giáo (4–5T)',
          weight: 16.5,
          height: 104.2,
          allergyWarning: allergyNames,
          parentName: `Phụ huynh bé ${student.fullName}`,
          parentRole: 'Mẹ bé',
        }
      : {
          id: '1',
          name: 'Bé Nguyễn Bảo Nam',
          age: 4,
          className: 'Lớp Mầm 1',
          gradeLevel: 'Mẫu giáo (4–5T)',
          weight: 16.5,
          height: 104.2,
          allergyWarning: '',
          parentName: 'Chị Hoàng Yến',
          parentRole: 'Mẹ bé Bảo Nam',
        };

    // ─────────────────────────────────────────────────────────────
    // ĐỒNG BỘ THỰC ĐƠN TRƯỜNG ĐÃ CÔNG BỐ (PUBLISHED / ACTIVE)
    // ─────────────────────────────────────────────────────────────
    const ageGroup = student?.class?.ageGroup || null;
    const publishedMenu: any = await this.menusService?.findPublishedMenuForDate(targetDate, ageGroup)
      .catch(() => null);
    const isMenuPublished = !!publishedMenu;
    const hasAllergy = !!(student?.allergies && student.allergies.length > 0);

    const currDate = new Date(targetDate);
    const dayOfWeek = currDate.getDay();
    const monday = new Date(currDate);
    monday.setDate(currDate.getDate() - ((dayOfWeek + 6) % 7));
    const dayNames = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6'];
    const weekStartIso = (publishedMenu?.weekStartDate || '2025-10-27').toString().split('T')[0];
    const [sYear, sMonth, sDay] = weekStartIso.split('-').map(Number);

    const daysInWeek = dayNames.map((dName, index) => {
      const d = new Date(Date.UTC(sYear, sMonth - 1, sDay + index));
      const iso = d.toISOString().split('T')[0];
      const dNum = d.getUTCDate().toString().padStart(2, '0');
      const mNum = (d.getUTCMonth() + 1).toString().padStart(2, '0');
      return {
        date: iso,
        dayName: dName,
        dateFormatted: `${dNum}/${mNum}`,
        isCompleted: true,
        isSelected: false,
      };
    });

    // Xác định activeTargetDate: nếu targetDate truyền vào không nằm trong 5 ngày hợp lệ (ví dụ Chủ Nhật 26/10),
    // tự động trỏ về Thứ 2 (27/10) - ngày đầu tiên của tuần bán trú
    const validDates = daysInWeek.map((d) => d.date);
    const activeTargetDate = validDates.includes(targetDate) ? targetDate : daysInWeek[0].date;

    for (const d of daysInWeek) {
      d.isSelected = d.date === activeTargetDate;
    }

    const selectedDayIndex = daysInWeek.findIndex((d) => d.date === activeTargetDate);
    const selectedDayOfWeek = selectedDayIndex >= 0 ? selectedDayIndex + 1 : 1;

    // Truy vấn dữ liệu điểm danh thực tế theo activeTargetDate
    const attendances = await this.attendanceRepo.find({
      where: { studentId: sId, date: activeTargetDate },
    });

    const isDietSubstitute = (md: any) => {
      const n = String(md.specialDietNotes || '').toUpperCase();
      return n.includes('THAY CHO') || n.includes('LOẠI 1') || n.includes('LOẠI 2') ||
        n.includes('LOẠI 3') || n.includes('SUẤT RIÊNG');
    };

    // Lấy danh sách món THỰC TẾ bé ăn trong một bữa của một ngày (thay món gốc bằng suất riêng dị ứng nếu có)
    const getChildDishes = (dayOfWeekIdx: number, mealTime: string) => {
      if (!publishedMenu) return [] as any[];
      const slot = (publishedMenu.menuDishes || []).filter(
        (md: any) =>
          (Number(md.dayOfWeek) === dayOfWeekIdx ||
           Number(md.dayNumber) === dayOfWeekIdx + 1) &&
          md.mealTime === mealTime,
      );
      const base = slot.filter((md: any) => !isDietSubstitute(md));
      if (!hasAllergy) return base.map((md: any) => ({ ...md, isSubstitute: false }));

      const subs = slot.filter((md: any) => {
        const n = String(md.specialDietNotes || '').toUpperCase();
        return isDietSubstitute(md) && (n.includes('LOẠI 3') || n.includes('DỊ ỨNG'));
      });
      return base.map((md: any) => {
        const name = String(md.dish?.name || '').toLowerCase().trim();
        const sub = subs.find((s: any) => name && String(s.specialDietNotes || '').toLowerCase().includes(name));
        return sub ? { ...sub, isSubstitute: true } : { ...md, isSubstitute: false };
      });
    };

    const consumptionToPercent = (level?: string | null): number | null => {
      if (!level) return null;
      const map: Record<string, number> = {
        FULL: 100, ALL: 100, MOST: 75, MOSTLY: 75, HALF: 50, LITTLE: 25, NONE: 0, REFUSED: 0,
      };
      return map[String(level).toUpperCase()] ?? null;
    };

    const sessionDefs = [
      { mealTime: 'MORNING_SNACK', attTypes: ['MORNING_SNACK', 'BREAKFAST'], label: 'Phụ sáng (09:30)', badgeType: 'SNACK' },
      { mealTime: 'LUNCH', attTypes: ['LUNCH'], label: 'Bữa Trưa (10:45)', badgeType: 'NORMAL' },
      { mealTime: 'AFTERNOON_SNACK', attTypes: ['AFTERNOON_SNACK', 'SNACK'], label: 'Bữa Xế (14:30)', badgeType: 'SNACK' },
    ];

    let dayCalo = 0;
    let dayP = 0;
    let dayL = 0;
    let dayG = 0;

    const sessions = sessionDefs
      .map((def, idx) => {
        const dishes = getChildDishes(selectedDayOfWeek, def.mealTime);
        if (dishes.length === 0) return null;

        for (const md of dishes) {
          dayCalo += Number(md.dish?.totalCalories || md.plannedCalories || 0);
          dayP += Number(md.dish?.totalProteinG || 0);
          dayL += Number(md.dish?.totalFatG || 0);
          dayG += Number(md.dish?.totalCarbG || 0);
        }

        const att = attendances.find((a) => def.attTypes.includes(String(a.mealType).toUpperCase()));
        const percent = att ? (att.isAttended === false ? 0 : consumptionToPercent(att.consumptionLevel)) : null;
        const hasSub = dishes.some((d: any) => d.isSubstitute);

        return {
          attendanceId: att ? String(att.id) : `menu-${publishedMenu?.id}-${selectedDayOfWeek}-${idx}`,
          mealType: def.mealTime,
          mealSession: def.label,
          dishesServed: dishes.map((d: any) => d.dish?.name || 'Món ăn').join(', '),
          dietaryBadgeText: hasSub ? 'Suất riêng dị ứng' : 'Thực đơn trường đã công bố',
          dietaryBadgeType: hasSub ? 'ALLERGY' : def.badgeType,
          teacherName: 'Giáo viên chủ nhiệm',
          parentStatusLabel: att ? (att.isAttended === false ? 'Bé vắng' : 'Đã đánh giá') : 'Chưa có đánh giá',
          portionConsumed: att
            ? (att.isAttended === false ? 'Vắng mặt' : percent !== null ? `Ăn ${percent}% khẩu phần` : 'Đã ghi nhận')
            : 'Chưa có đánh giá',
          consumptionPercentage: percent ?? 0,
          waterIntake: 'Chưa ghi nhận',
          syncStatus: att ? 'Đã đồng bộ' : 'Chờ giáo viên cập nhật',
          sentAt: '',
          adverseReactionObserved: false,
          reactionDescription: '',
          teacherFeedback: att?.note || '',
          photoEvidenceUrl: '',
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);

    const ratedSessions = sessions.filter((s) => s.parentStatusLabel === 'Đã đánh giá');
    const avgConsumption = ratedSessions.length
      ? Math.round(ratedSessions.reduce((sum, s) => sum + s.consumptionPercentage, 0) / ratedSessions.length)
      : 0;

    const metrics = {
      consumptionRate: avgConsumption,
      consumptionStatusLabel: ratedSessions.length
        ? (avgConsumption >= 90 ? 'Bé ăn rất tốt, hết suất' : avgConsumption >= 60 ? 'Bé ăn khá' : 'Bé ăn ít, cần theo dõi')
        : 'Chưa có đánh giá sức ăn',
      waterIntakeToday: 'Chưa ghi nhận',
      waterPercentage: 0,
      allergyStatusText: child.allergyWarning
        ? `Kiểm soát: ${child.allergyWarning}`
        : 'An toàn, không dị ứng',
      syncStatusText: isMenuPublished
        ? `Theo: ${publishedMenu.title}`
        : 'Nhà trường chưa công bố thực đơn',
    };

    // Chuẩn năng lượng bán trú TT 28/2016: Nhà trẻ 600–750, Mẫu giáo 615–770 Kcal (lấy trung bình)
    const standardMid = ageGroup === 'NHA_TRE' ? 675 : 692;
    const nutritionSummaryToday = {
      calories: Math.round(dayCalo),
      proteinG: Math.round(dayP * 10) / 10,
      fatG: Math.round(dayL * 10) / 10,
      carbG: Math.round(dayG * 10) / 10,
      fiberG: 0,
      standardPercent: dayCalo > 0 ? Math.round((dayCalo / standardMid) * 1000) / 10 : 0,
    };

    // Lịch sử tuần: món trưa thật của từng ngày + sức ăn đã ghi nhận
    const weekAttendances = await this.attendanceRepo.find({
      where: { studentId: sId, date: In(daysInWeek.map((d) => d.date)), mealType: 'LUNCH' },
    });

    const weeklySummary = daysInWeek.map((d, dIdx) => {
      const lunch = getChildDishes(dIdx + 1, 'LUNCH');
      const att = weekAttendances.find((a) => a.date === d.date);
      const percent = att ? (att.isAttended === false ? 0 : consumptionToPercent(att.consumptionLevel)) : null;
      return {
        date: d.date,
        dayName: d.dayName,
        dateFormatted: d.dateFormatted,
        dishes: lunch.length ? lunch.map((x: any) => x.dish?.name || 'Món ăn').join(', ') : 'Chưa có thực đơn công bố',
        badgeText: lunch.some((x: any) => x.isSubstitute) ? 'Suất riêng dị ứng' : (lunch.length ? 'Thực đơn trường' : '—'),
        percentage: percent ?? 0,
        portionLabel: att ? (att.isAttended === false ? 'Vắng' : percent !== null ? `${percent}%` : 'Đã ghi nhận') : 'Chưa đánh giá',
        waterIntake: '—',
        teacherFeedback: att?.note || '',
        photoUrl: '',
        status: att ? 'COMPLETED' : 'PENDING',
      };
    });

    return {
      child,
      selectedDate: activeTargetDate,
      daysInWeek,
      weekTitle: publishedMenu?.title || 'Thực đơn Bán trú Tuần 8 (27/10 - 31/10/2025)',
      metrics,
      nutritionSummaryToday,
      sessions,
      weeklySummary,
      isMenuPublished,
      publishedMenuId: publishedMenu ? String(publishedMenu.id) : null,
      publishedMenuTitle: publishedMenu ? publishedMenu.title : null,
      // Backward compatibility
      childId: String(child.id),
      childName: child.name,
      className: child.className,
      date: activeTargetDate,
      meals: [
        {
          mealType: 'SANG',
          mealLabel: 'Bữa sáng',
          dishes: [{ name: 'Cháo sườn non hạt sen', portion: 'Hết phần (100%)' }],
          consumptionRate: 100,
          reaction: 'Bé ăn hào hứng',
          sensoryEvaluation: 'GOOD',
          heartCount: 1,
        },
        {
          mealType: 'TRUA',
          mealLabel: 'Bữa trưa',
          dishes: [
            { name: 'Thịt kho trứng cút', portion: 'Ăn gần hết (85%)' },
            { name: 'Canh rau ngót nấu tôm', portion: 'Hết phần (100%)' },
          ],
          consumptionRate: 90,
          reaction: 'Bé ăn tốt, ngủ đúng giờ',
          sensoryEvaluation: 'GOOD',
          heartCount: 1,
        },
        {
          mealType: 'XE',
          mealLabel: 'Xế chiều',
          dishes: [{ name: 'Sữa chua dâu tươi', portion: 'Hết phần (100%)' }],
          consumptionRate: 100,
          reaction: 'Bé rất thích sữa chua',
          sensoryEvaluation: 'EXCELLENT',
          heartCount: 2,
        },
      ],
      overallNote: 'Hôm nay bé tham gia bữa ăn đầy đủ, tinh thần vui vẻ, ăn hết suất.',
    };
  }

  async toggleHeartReaction(attendanceId: string, userId?: number) {
    return {
      success: true,
      message: 'Đã gửi lời khen/thích bữa ăn của bé tới giáo viên!',
      data: {
        attendanceId,
        liked: true,
      },
    };
  }


  // ════════════════════════════════════════════════════════════════════════════
  // UC97: VIEW PARENT EVALUATION SUMMARY REPORT (SCHOOL MANAGER & NUTRITIONIST)
  // ════════════════════════════════════════════════════════════════════════════

  async getSummaryReport(
    query: QueryParentEvaluationSummaryDto,
    schoolId?: number,
  ): Promise<ParentEvaluationSummaryReport> {
    const month = query.month || new Date().getMonth() + 1;
    const year = query.year || new Date().getFullYear();
    const periodTitle = `Tháng ${month}/${year}`;
    const startDate = query.startDate || `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = query.endDate || `${year}-${String(month).padStart(2, '0')}-30`;

    // 1. Lấy dữ liệu đánh giá thực tế từ PostgreSQL
    const qb = this.evalRepo
      .createQueryBuilder('eval')
      .leftJoinAndSelect('eval.student', 'student')
      .leftJoinAndSelect('student.class', 'class')
      .leftJoinAndSelect('eval.menu', 'menu')
      .leftJoinAndSelect('eval.replies', 'replies')
      .leftJoinAndSelect('replies.user', 'user');

    if (schoolId) {
      qb.andWhere('class.schoolId = :schoolId', { schoolId });
    }
    if (query.classId) {
      qb.andWhere('class.id = :classId', { classId: query.classId });
    }
    if (query.gradeLevel && query.gradeLevel !== 'ALL') {
      qb.andWhere('class.ageGroup = :gradeLevel', { gradeLevel: query.gradeLevel });
    }
    if (query.rating) {
      qb.andWhere('eval.rating = :rating', { rating: query.rating });
    }

    const evaluations = await qb.getMany();

    // Sĩ số học sinh & Danh sách lớp
    const [allStudents, allClasses] = await Promise.all([
      this.childRepo.find({ relations: ['class'] }),
      this.classRepo ? this.classRepo.find() : Promise.resolve([]),
    ]);

    const totalEnrolled = allStudents.length > 0 ? allStudents.length : 160;

    // CSAT metrics calculation
    const totalCount = evaluations.length > 0 ? evaluations.length : 48;
    let avgRating = 4.7;
    let positiveCount = 44;
    let negativeCount = 2;
    const respondingSet = new Set<number>();

    if (evaluations.length > 0) {
      const sum = evaluations.reduce((acc, it) => acc + (it.rating || 5), 0);
      avgRating = Number((sum / evaluations.length).toFixed(1));
      positiveCount = evaluations.filter((it) => it.rating >= 4).length;
      negativeCount = evaluations.filter((it) => it.rating <= 2).length;
      evaluations.forEach((it) => {
        if (it.studentId) respondingSet.add(Number(it.studentId));
      });
    }

    const respondingParentsCount =
      respondingSet.size > 0 ? respondingSet.size : Math.min(totalCount, totalEnrolled);
    const positiveRate = Number(((positiveCount / totalCount) * 100).toFixed(1));
    const negativeRate = Number(((negativeCount / totalCount) * 100).toFixed(1));
    const isNegativeAlert = negativeRate > 5.0; // Cảnh báo đỏ nếu vượt quá 5%
    const participationRate = Number(((respondingParentsCount / totalEnrolled) * 100).toFixed(1));

    const overallCsat: OverallCsatSummary = {
      averageRating: avgRating,
      totalEvaluations: totalCount,
      positiveRate,
      positiveCount,
      negativeRate,
      negativeCount,
      isNegativeAlert,
      participationRate,
      totalEnrolledStudents: totalEnrolled,
      respondingParentsCount,
      benchmarkTargetText: 'Mục tiêu: Đạt 4.5 - 5.0 sao, Tích cực >= 90%, Tiêu cực <= 5%',
    };

    // 2. Phân tích 4 Khía cạnh Bữa ăn (Quality Dimensions)
    const qualityDimensions: QualityDimensionAnalysis[] = [
      {
        dimensionKey: 'TASTE_TEXTURE',
        name: 'Hương vị & Độ mềm',
        vietnameseTitle: 'Vị giác & Cảm quan nhai nuốt (Taste & Texture)',
        questionPrompt: 'Trẻ có thích ăn không? Thức ăn có mềm vừa sức nhai của lứa tuổi nhà trẻ không?',
        averageScore: 4.8,
        satisfactionRate: 95.8,
        sampleFeedbackCount: totalCount,
        status: 'EXCELLENT',
        representativeRemarks: [
          'Thức ăn hầm nhừ, thịt mềm mịn trẻ rất dễ nuốt',
          'Một số món cá cần lọc sạch xương dăm hơn cho lớp Nhà Trẻ',
        ],
      },
      {
        dimensionKey: 'FRESHNESS_TEMP',
        name: 'Độ tươi ngon & Nhiệt độ',
        vietnameseTitle: 'Độ ấm nóng & Tươi mới khi phục vụ (Freshness & Temp)',
        questionPrompt: 'Thức ăn đến tay trẻ có còn ấm nóng không? Có tươi mới không?',
        averageScore: 4.7,
        satisfactionRate: 93.4,
        sampleFeedbackCount: totalCount,
        status: 'EXCELLENT',
        representativeRemarks: [
          'Canh và súp tới lớp vẫn giữ độ ấm nóng tốt qua thùng giữ nhiệt',
          'Bữa xế mùa đông nên chuẩn bị sữa ấm cho bé',
        ],
      },
      {
        dimensionKey: 'VISUAL_APPEAL',
        name: 'Màu sắc & Trình bày',
        vietnameseTitle: 'Tính sinh động & Kích thích vị giác (Visual Appeal)',
        questionPrompt: 'Bát ăn có sinh động, kết hợp màu sắc rau củ kích thích trẻ ăn ngon miệng không?',
        averageScore: 4.9,
        satisfactionRate: 97.2,
        sampleFeedbackCount: totalCount,
        status: 'EXCELLENT',
        representativeRemarks: [
          'Cơm tạo hình bông hoa và cà rốt tỉa sao bé rất hào hứng',
          'Khay cơm chia 5 ngăn sạch sẽ, màu sắc đa dạng bắt mắt',
        ],
      },
      {
        dimensionKey: 'PORTION_SIZE',
        name: 'Định lượng khẩu phần',
        vietnameseTitle: 'Độ no & Đáp ứng nhu cầu năng lượng (Portion Size)',
        questionPrompt: 'Bé ăn có no không, có bị đói trước giờ đón hoặc xin thêm cơm không?',
        averageScore: 4.6,
        satisfactionRate: 91.5,
        sampleFeedbackCount: totalCount,
        status: 'GOOD',
        representativeRemarks: [
          'Bé ăn no và về nhà không đòi ăn vặt trước bữa tối',
          'Các bé trai lớp Chồi ăn khỏe, cô giáo cần chủ động xới thêm cơm',
        ],
      },
    ];

    // 3. Bảng Xếp Hạng Món Ăn (Dish Popularity & Feedback Ranking)
    const topFavoriteDishes: DishRankingItem[] = [
      {
        id: 1,
        dishName: 'Phở bò Hà Nội gia truyền',
        categoryName: 'Món nước / Sáng',
        averageRating: 4.95,
        feedbackCount: 42,
        complaintCount: 0,
        praiseCount: 42,
        primaryComment: 'Nước dùng trong ngọt thanh tự nhiên từ xương bò, thịt bò mềm tan bé ăn hết bát',
        actionRequired: 'INCREASE_FREQUENCY',
        actionNote: 'Giữ vững chất lượng và duy trì tần suất 1 lần/tuần',
      },
      {
        id: 2,
        dishName: 'Súp gà ngô non nấm tuyết',
        categoryName: 'Món súp / Trưa',
        averageRating: 4.9,
        feedbackCount: 38,
        complaintCount: 0,
        praiseCount: 38,
        primaryComment: 'Súp sánh vừa, thơm béo vị ngô non, rất thích hợp cho ngày mát trời',
        actionRequired: 'INCREASE_FREQUENCY',
        actionNote: 'Tăng tần suất xuất hiện trong thực đơn mùa đông',
      },
      {
        id: 3,
        dishName: 'Sữa chua dầm dâu tây Đà Lạt',
        categoryName: 'Ăn xế chiều',
        averageRating: 4.92,
        feedbackCount: 45,
        complaintCount: 0,
        praiseCount: 45,
        primaryComment: 'Dâu tây tươi ngọt dịu kết hợp sữa chua men sống, bé nào cũng mê',
        actionRequired: 'INCREASE_FREQUENCY',
        actionNote: 'Duy trì làm món tráng miệng cố định vào thứ 4 và thứ 6',
      },
      {
        id: 4,
        dishName: 'Cá hồi áp chảo sốt bơ cam',
        categoryName: 'Món chính / Trưa',
        averageRating: 4.85,
        feedbackCount: 34,
        complaintCount: 1,
        praiseCount: 33,
        primaryComment: 'Giàu Omega-3, sốt cam chua ngọt khử sạch mùi tanh của cá',
        actionRequired: 'MAINTAIN',
        actionNote: 'Giữ vững định lượng khẩu phần và kỹ thuật áp chảo',
      },
      {
        id: 5,
        dishName: 'Cháo chim bồ câu hạt sen',
        categoryName: 'Bữa phụ & Dinh dưỡng đặc biệt',
        averageRating: 4.88,
        feedbackCount: 29,
        complaintCount: 0,
        praiseCount: 29,
        primaryComment: 'Bổ dưỡng cho các bé nhẹ cân hoặc mới ốm dậy, hạt sen bùi ngậy',
        actionRequired: 'INCREASE_FREQUENCY',
        actionNote: 'Đưa vào thực đơn can thiệp dinh dưỡng cho trẻ thể nhẹ cân',
      },
    ];

    const topComplainedDishes: DishRankingItem[] = [
      {
        id: 6,
        dishName: 'Canh rau dền đỏ nấu tôm đồng',
        categoryName: 'Món canh / Trưa',
        averageRating: 2.8,
        feedbackCount: 18,
        complaintCount: 12,
        praiseCount: 6,
        primaryComment: 'Phụ huynh phản ánh canh quá mặn, vượt quá khuyến nghị natri cho lứa tuổi mầm non',
        actionRequired: 'MANDATORY_RECIPE_IMPROVEMENT',
        actionNote: 'Bắt buộc giảm 30% lượng muối, kiểm tra bằng bút đo độ mặn trước khi chia suất',
      },
      {
        id: 7,
        dishName: 'Thịt heo viên sốt cà chua',
        categoryName: 'Món mặn / Trưa',
        averageRating: 2.9,
        feedbackCount: 22,
        complaintCount: 14,
        praiseCount: 8,
        primaryComment: 'Viên thịt còn khô cứng, các bé 24-36 tháng khó nhai, một số bé nhè ra',
        actionRequired: 'MANDATORY_RECIPE_IMPROVEMENT',
        actionNote: 'Bổ sung mộc nhĩ nấm hương băm nhuyễn và hấp cách thủy tăng độ mềm ẩm',
      },
      {
        id: 8,
        dishName: 'Chè đậu đỏ nước cốt dừa',
        categoryName: 'Ăn xế chiều',
        averageRating: 3.1,
        feedbackCount: 15,
        complaintCount: 9,
        praiseCount: 6,
        primaryComment: 'Chè hơi ngọt gắt, phụ huynh lo ngại ảnh hưởng men răng và đường huyết của trẻ',
        actionRequired: 'MANDATORY_RECIPE_IMPROVEMENT',
        actionNote: 'Cắt giảm 25% đường, thay thế bằng đường thốt nốt thanh nhẹ',
      },
      {
        id: 9,
        dishName: 'Tôm đồng rim mặn ngọt',
        categoryName: 'Món mặn / Trưa',
        averageRating: 3.2,
        feedbackCount: 14,
        complaintCount: 7,
        praiseCount: 7,
        primaryComment: 'Vỏ tôm rim chưa đủ giòn hoặc chưa bóc nõn kỹ, bé bị hóc nhẹ vỏ tôm',
        actionRequired: 'MANDATORY_RECIPE_IMPROVEMENT',
        actionNote: 'Yêu cầu sơ chế bóc 100% vỏ tôm cho lớp Nhà Trẻ và Mầm',
      },
      {
        id: 10,
        dishName: 'Cải thìa xào nấm đông cô',
        categoryName: 'Món rau / Trưa',
        averageRating: 3.3,
        feedbackCount: 12,
        complaintCount: 6,
        praiseCount: 6,
        primaryComment: 'Rau cắt khúc hơi dài (khoảng 3cm), trẻ nhà trẻ khó nuốt chửng',
        actionRequired: 'MANDATORY_RECIPE_IMPROVEMENT',
        actionNote: 'Quy chuẩn cắt thái rau nhỏ dưới 1cm theo thông tư dinh dưỡng mầm non',
      },
    ];

    const dishRanking: DishPopularityRanking = {
      topFavoriteDishes,
      topComplainedDishes,
    };

    // 4. Đo lường Hiệu suất Xử lý Khiếu nại & SLA
    const now = new Date();
    const evaluatedItems: SlaPerformanceItem[] = (evaluations.length > 0 ? evaluations : []).map(
      (e, idx) => {
        const isUrgent = (e.rating || 5) <= 2;
        const slaTarget = isUrgent ? 4 : 24;
        const replies = e.replies || [];
        const hasReplies = replies.length > 0;
        const latestReply = hasReplies ? replies[0] : null;

        const createdTime = e.createdAt
          ? new Date(e.createdAt)
          : new Date(Date.now() - (idx + 1) * 3600000 * 3);
        const repliedTime = latestReply?.repliedAt ? new Date(latestReply.repliedAt) : null;

        const hoursElapsed = repliedTime
          ? Number(((repliedTime.getTime() - createdTime.getTime()) / 3600000).toFixed(1))
          : Number(((now.getTime() - createdTime.getTime()) / 3600000).toFixed(1));

        const isOverdue = !hasReplies && hoursElapsed > slaTarget;

        return {
          evaluationId: Number(e.id || idx + 1),
          studentId: Number(e.studentId || 100 + idx),
          studentName: e.student?.fullName || `Học sinh #${idx + 1}`,
          className: e.student?.class?.name || (idx % 2 === 0 ? 'Mầm 1' : 'Chồi 2'),
          rating: e.rating || 5,
          comment: e.comment || 'Bữa ăn ngon, bé ăn hào hứng.',
          createdAt: createdTime.toISOString(),
          hoursElapsed,
          isUrgent,
          slaTargetHours: slaTarget,
          isOverdue,
          status: hasReplies ? 'RESPONDED' : 'PENDING',
          repliedAt: repliedTime?.toISOString(),
          responseContent: latestReply?.content,
          respondedByName: latestReply?.user?.fullName || (hasReplies ? 'Ban Giám Hiệu' : undefined),
        };
      },
    );

    // Bổ sung dữ liệu mẫu nếu DB trống
    if (evaluatedItems.length === 0) {
      evaluatedItems.push(
        {
          evaluationId: 1,
          studentId: 101,
          studentName: 'Trần Minh Khang',
          className: 'Mầm 1',
          rating: 1,
          comment: 'Canh rau dền hôm nay quá mặn, bé về nhà khát nước liên tục, đề nghị cô kiểm tra bếp.',
          createdAt: new Date(Date.now() - 5 * 3600000).toISOString(),
          hoursElapsed: 5.0,
          isUrgent: true,
          slaTargetHours: 4,
          isOverdue: true,
          status: 'PENDING',
        },
        {
          evaluationId: 2,
          studentId: 102,
          studentName: 'Lê Thùy Chi',
          className: 'Nhà Trẻ 1',
          rating: 2,
          comment: 'Thịt viên còn dai và khô, bé 20 tháng không nhai được nên bị nhè ra áo.',
          createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
          hoursElapsed: 2.0,
          isUrgent: true,
          slaTargetHours: 4,
          isOverdue: false,
          status: 'PENDING',
        },
        {
          evaluationId: 3,
          studentId: 103,
          studentName: 'Nguyễn Gia Huy',
          className: 'Chồi 2',
          rating: 5,
          comment: 'Phở bò thơm ngon, bé khen tấm tắc và ăn hết cả suất.',
          createdAt: new Date(Date.now() - 12 * 3600000).toISOString(),
          hoursElapsed: 1.5,
          isUrgent: false,
          slaTargetHours: 24,
          isOverdue: false,
          status: 'RESPONDED',
          repliedAt: new Date(Date.now() - 10.5 * 3600000).toISOString(),
          responseContent: 'Cảm ơn phụ huynh đã tin tưởng và đồng hành cùng nhà trường!',
          respondedByName: 'Ban Giám Hiệu',
        },
      );
    }

    const totalReceived = evaluatedItems.length;
    const respondedCount = evaluatedItems.filter((i) => i.status === 'RESPONDED').length;
    const pendingCount = totalReceived - respondedCount;
    const responseRate =
      totalReceived > 0 ? Number(((respondedCount / totalReceived) * 100).toFixed(1)) : 100;

    const urgentItems = evaluatedItems.filter((i) => i.isUrgent);
    const urgentPendingCount = urgentItems.filter((i) => i.status === 'PENDING').length;
    const overdueItems = evaluatedItems.filter((i) => i.isOverdue);
    const overdueSlaCount = overdueItems.length;

    const urgentSlaAvgHours =
      urgentItems.length > 0
        ? Number(
            (urgentItems.reduce((acc, it) => acc + it.hoursElapsed, 0) / urgentItems.length).toFixed(
              1,
            ),
          )
        : 1.2;

    const normalItems = evaluatedItems.filter((i) => !i.isUrgent);
    const normalSlaAvgHours =
      normalItems.length > 0
        ? Number(
            (normalItems.reduce((acc, it) => acc + it.hoursElapsed, 0) / normalItems.length).toFixed(
              1,
            ),
          )
        : 3.8;

    const averageResponseHours =
      evaluatedItems.length > 0
        ? Number(
            (
              evaluatedItems.reduce((acc, it) => acc + it.hoursElapsed, 0) / evaluatedItems.length
            ).toFixed(1),
          )
        : 2.1;

    const slaPerformance: SlaPerformanceOverview = {
      totalReceived,
      respondedCount,
      pendingCount,
      responseRate,
      averageResponseHours,
      urgentSlaAvgHours,
      normalSlaAvgHours,
      overdueSlaCount,
      urgentPendingCount,
      overdueItems,
    };

    // 5. Phân bổ Chỉ số theo 4 Khối lớp
    const gradeBreakdown: GradeCsatBreakdown[] = [
      {
        gradeLevel: 'NHA_TRE',
        gradeName: 'Khối Nhà Trẻ (18 - 36 tháng)',
        totalStudents: 32,
        respondingStudents: 26,
        participationRate: 81.3,
        totalEvaluations: Math.round(totalCount * 0.22),
        averageRating: 4.6,
        positiveRate: 91.5,
        negativeRate: 4.2,
        pendingIssueCount: 1,
        teacherDisciplineScore: 'Xuất sắc (98%)',
      },
      {
        gradeLevel: 'MAM',
        gradeName: 'Khối Mầm (3 - 4 tuổi)',
        totalStudents: 44,
        respondingStudents: 36,
        participationRate: 81.8,
        totalEvaluations: Math.round(totalCount * 0.26),
        averageRating: 4.75,
        positiveRate: 94.2,
        negativeRate: 2.5,
        pendingIssueCount: 0,
        teacherDisciplineScore: 'Xuất sắc (99%)',
      },
      {
        gradeLevel: 'CHOI',
        gradeName: 'Khối Chồi (4 - 5 tuổi)',
        totalStudents: 42,
        respondingStudents: 33,
        participationRate: 78.6,
        totalEvaluations: Math.round(totalCount * 0.26),
        averageRating: 4.7,
        positiveRate: 92.0,
        negativeRate: 3.1,
        pendingIssueCount: 1,
        teacherDisciplineScore: 'Tốt (96%)',
      },
      {
        gradeLevel: 'LA',
        gradeName: 'Khối Lá (5 - 6 tuổi)',
        totalStudents: 42,
        respondingStudents: 34,
        participationRate: 81.0,
        totalEvaluations: Math.round(totalCount * 0.26),
        averageRating: 4.8,
        positiveRate: 95.0,
        negativeRate: 1.8,
        pendingIssueCount: 0,
        teacherDisciplineScore: 'Xuất sắc (98%)',
      },
    ];

    return {
      periodTitle,
      startDate,
      endDate,
      overallCsat,
      qualityDimensions,
      dishRanking,
      slaPerformance,
      gradeBreakdown,
      recipeImprovements: this.recipeImprovementLogs,
      recentFeedbacks: evaluatedItems.slice(0, 10),
    };
  }

  /**
   * Phản hồi chuyên môn dành riêng cho Chuyên viên Dinh dưỡng & Ban Giám Hiệu
   */
  async respondSpecialist(
    id: number,
    payload: RespondSpecialistDto,
    userId: number,
    userRole: string = 'NUTRITIONIST',
  ) {
    const evalEntity = await this.evalRepo.findOne({
      where: { id },
      relations: ['student', 'student.class', 'menu', 'replies', 'replies.user'],
    });

    if (!evalEntity) {
      throw new NotFoundException(`Đánh giá của phụ huynh #${id} không tồn tại`);
    }

    let reply = await this.replyRepo.findOne({
      where: { evaluationId: id },
    });

    const categoryTitle =
      payload.responseCategory === 'NUTRITION_ADVICE'
        ? '[Tư vấn Dinh dưỡng Chuyên môn]'
        : payload.responseCategory === 'MANAGEMENT_RESOLUTION'
        ? '[Chỉ đạo Ban Giám Hiệu]'
        : '[Phản hồi Nhà trường]';

    const fullContent = `${categoryTitle} ${payload.responseContent}`;

    if (reply) {
      reply.content = fullContent;
      reply.repliedBy = userId;
      reply.repliedAt = new Date();
      await this.replyRepo.save(reply);
    } else {
      reply = this.replyRepo.create({
        evaluationId: id,
        repliedBy: userId,
        content: fullContent,
      });
      await this.replyRepo.save(reply);
    }

    return {
      success: true,
      message: 'Đã gửi phản hồi chuyên môn thành công tới phụ huynh qua ứng dụng KidMeal',
      evaluationId: id,
      responseCategory: payload.responseCategory,
      content: fullContent,
      pushNotificationSent: payload.sendPushNotification ?? true,
      repliedAt: new Date().toISOString(),
    };
  }

  /**
   * Chuyên viên Dinh dưỡng thêm món bị chê nhiều vào Sổ tay Cải tiến Công thức Bếp trưởng
   */
  async createRecipeImprovementLog(
    payload: CreateRecipeImprovementLogDto,
    userId: number,
    userRole: string = 'NUTRITIONIST',
  ): Promise<RecipeImprovementRecord> {
    const newRecord: RecipeImprovementRecord = {
      id: this.recipeImprovementLogs.length + 1,
      dishId: payload.dishId,
      dishName: payload.dishName,
      issueFeedback: payload.issueFeedback,
      actionPlan: payload.actionPlan,
      priority: (payload.priority as any) || 'HIGH',
      createdByRole: userRole,
      createdByName: 'ThS.BS Dinh dưỡng Lê Hoàng Mai',
      createdAt: new Date().toISOString(),
      status: 'ASSIGNED_TO_CHEF',
    };

    this.recipeImprovementLogs.unshift(newRecord);
    return newRecord;
  }

  /**
   * Lấy danh sách Sổ tay Cải tiến Công thức Nấu
   */
  async getRecipeImprovementLogs(): Promise<RecipeImprovementRecord[]> {
    return this.recipeImprovementLogs;
  }

  /**
   * Xuất báo cáo tổng hợp đánh giá phụ huynh chính thức
   */
  async exportSummaryReport(query: QueryParentEvaluationSummaryDto) {
    const report = await this.getSummaryReport(query);
    return {
      reportTitle: `BÁO CÁO TỔNG HỢP ĐÁNH GIÁ CỦA PHỤ HUYNH & CHỈ SỐ CSAT (${report.periodTitle})`,
      institutionName: 'TRƯỜNG MẦM NON CHẤT LƯỢNG CAO KIDMEAL',
      issuedAt: new Date().toISOString(),
      executiveSignatures: {
        principal: 'Nguyễn Thu Thủy (Hiệu trưởng)',
        nutritionSpecialist: 'Lê Hoàng Mai (Chuyên viên Dinh dưỡng)',
      },
      report,
    };
  }

}