import { AttendanceService } from '../../../src/modules/attendance/services/attendance.service';

/**
 * Unit test: Trạng thái bếp theo lớp (Chia khay / Xuất khay) trên màn hình KDS.
 */
describe('AttendanceService - Kitchen status (KDS Chia khay / Xuất khay)', () => {
  let attendanceRepo: any;
  let classRepo: any;
  let childRepo: any;
  let service: AttendanceService;
  let savedStatuses: Array<{ class_id: number; chef_feedback: string }>;
  let submissions: any[];

  beforeEach(() => {
    savedStatuses = [];
    submissions = [];
    attendanceRepo = {
      query: jest.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('INSERT INTO meal_evaluation_locks')) {
          const [classId, , status] = params;
          const existing = savedStatuses.find((s) => s.class_id === classId);
          if (existing) existing.chef_feedback = status;
          else savedStatuses.push({ class_id: classId, chef_feedback: status });
          return [];
        }
        if (sql.includes("meal_type = 'KITCHEN_STATUS'")) return savedStatuses;
        if (sql.includes('FROM daily_meal_portions')) return submissions;
        if (sql.includes('FROM menu_dishes')) return [{ id: '1', name: 'Cơm trắng' }];
        return [];
      }),
    };
    classRepo = {
      find: jest.fn(async () => [
        { id: 1, name: 'Lớp Mầm 1', ageGroup: 'MAU_GIAO' },
        { id: 2, name: 'Lớp Chồi 1', ageGroup: 'MAU_GIAO' },
      ]),
    };
    childRepo = {
      count: jest.fn(async ({ where: { classId } }) => (classId === 1 ? 10 : 8)),
      manager: {
        query: jest.fn(async (_sql: string, [classId]: any[]) =>
          classId === 1 ? [{ full_name: 'Nguyễn Gia Huy', allergen_name: 'Tôm' }] : [],
        ),
      },
    };
    service = new AttendanceService(attendanceRepo, classRepo, childRepo);
  });

  it('updateKitchenStatus lưu trạng thái vào meal_evaluation_locks với meal_type KITCHEN_STATUS (upsert)', async () => {
    const res = await service.updateKitchenStatus({ classId: '2', status: 'DISPATCHED', date: '2026-11-05' });
    expect(res).toEqual(expect.objectContaining({ success: true, classId: '2', status: 'DISPATCHED' }));
    const [sql, params] = attendanceRepo.query.mock.calls[0];
    expect(sql).toContain("'KITCHEN_STATUS'");
    expect(sql).toContain('ON CONFLICT');
    expect(params).toEqual([2, '2026-11-05', 'DISPATCHED']);
  });

  it('updateKitchenStatus mặc định PREPARING và lớp 1 khi thiếu dữ liệu không hợp lệ', async () => {
    const res = await service.updateKitchenStatus({ classId: 'abc', status: '' , date: '2026-11-05' });
    expect(res.classId).toBe('1');
    expect(res.status).toBe('PREPARING');
  });

  it('updateKitchenStatus dùng ngày hôm nay khi không truyền date', async () => {
    await service.updateKitchenStatus({ classId: '1', status: 'PREPARING' });
    const params = attendanceRepo.query.mock.calls[0][1];
    expect(params[1]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('getKitchenKdsData phản ánh trạng thái bếp đã lưu, kể cả khi giáo viên chưa chốt sổ', async () => {
    await service.updateKitchenStatus({ classId: '1', status: 'PREPARING', date: '2026-11-05' });
    const kds: any = await service.getKitchenKdsData('2026-11-05');
    const mam1 = kds.classes.find((c: any) => c.classId === '1');
    const choi1 = kds.classes.find((c: any) => c.classId === '2');
    expect(mam1.status).toBe('PREPARING');
    expect(mam1.kitchenStatus).toBe('PREPARING');
    expect(mam1.isLocked).toBe(false);
    expect(choi1.status).toBe('WAITING');
  });

  it('getKitchenKdsData tính suất trưa/xế và cảnh báo dị ứng theo lớp', async () => {
    submissions = [
      { class_id: 1, meal_type: 'LUNCH', planned_quantity: 9, attendance_snapshot: [{ isAttended: true }, { isAttended: false }] },
      { class_id: 1, meal_type: 'AFTERNOON_SNACK', planned_quantity: 7 },
    ];
    const kds: any = await service.getKitchenKdsData('2026-11-05');
    const mam1 = kds.classes.find((c: any) => c.classId === '1');
    expect(mam1.status).toBe('SYNCED');
    expect(mam1.lunchCount).toBe(9);
    expect(mam1.snackCount).toBe(7);
    expect(mam1.absentCount).toBe(1);
    expect(mam1.allergies[0]).toContain('Tôm');
    expect(kds.totalPlanned).toBe(18);
    expect(kds.summary.totalLunchPortions).toBe(9);
    expect(kds.summary.totalSnackPortions).toBe(7);
  });

  it('trạng thái bếp đã lưu ưu tiên hơn trạng thái SYNCED', async () => {
    submissions = [{ class_id: 1, meal_type: 'LUNCH', planned_quantity: 5 }];
    await service.updateKitchenStatus({ classId: '1', status: 'DISPATCHED', date: '2026-11-05' });
    const kds: any = await service.getKitchenKdsData('2026-11-05');
    expect(kds.classes.find((c: any) => c.classId === '1').status).toBe('DISPATCHED');
  });
});

