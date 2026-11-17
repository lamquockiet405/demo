/**
 * SYSTEM / E2E TEST: Toàn bộ luồng hoạt động theo 5 vai trò trên hệ thống test
 * 1. Hiệu trưởng (SCHOOL_MANAGER)
 * 2. Chuyên viên Dinh dưỡng (NUTRITIONIST)
 * 3. Nhân viên Bếp (KITCHEN_STAFF)
 * 4. Giáo viên (TEACHER)
 * 5. Phụ huynh (PARENT)
 *
 * Chạy trực tiếp: node --test scripts/test/system-role-flows.test.cjs
 */
const { test, it, describe, before } = require('node:test');
const assert = require('node:assert/strict');

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001/api/v1';

async function quickLogin(roleCode, tenantId = 1) {
  const res = await fetch(`${BASE_URL}/auth/quick-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roleCode, tenantId: String(tenantId) }),
  });
  assert.equal(res.status, 200, `Quick login cho ${roleCode} thất bại: status ${res.status}`);
  const json = await res.json();
  const token = json.data?.accessToken;
  assert.ok(token, `Không lấy được accessToken cho ${roleCode}`);
  return {
    token,
    user: json.data?.user,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-tenant-id': String(tenantId),
    },
  };
}

describe('HỆ THỐNG TEST ĐA VAI TRÒ (SYSTEM TEST SUITE)', () => {
  let principalAuth;
  let nutritionistAuth;
  let kitchenAuth;
  let teacherAuth;
  let parentAuth;

  before(async () => {
    principalAuth = await quickLogin('SCHOOL_MANAGER');
    nutritionistAuth = await quickLogin('NUTRITIONIST');
    kitchenAuth = await quickLogin('KITCHEN_STAFF');
    teacherAuth = await quickLogin('TEACHER');
    parentAuth = await quickLogin('PARENT');
  });

  // ────────────────────────────────────────────────────────────────
  // 1. HIỆU TRƯỞNG (SCHOOL_MANAGER / PRINCIPAL)
  // ────────────────────────────────────────────────────────────────
  describe('Vai trò Hiệu trưởng (PRINCIPAL / SCHOOL_MANAGER)', () => {
    it('Lấy danh sách giáo viên có trạng thái ACTIVE để phân công lớp học', async () => {
      const res = await fetch(`${BASE_URL}/users/staff?roleCode=TEACHER&status=ACTIVE`, {
        headers: principalAuth.headers,
      });
      assert.equal(res.status, 200, 'API /users/staff phải trả về 200');
      const body = await res.json();
      const teachers = body.data?.data || body.data?.items || body.data || [];
      assert.ok(Array.isArray(teachers), 'Dữ liệu giáo viên phải là mảng');
      assert.ok(teachers.length > 0, 'Phải có ít nhất 1 giáo viên ACTIVE để phân công lớp');

      // Giáo viên phải có đầy đủ id và fullName
      const gv = teachers[0];
      assert.ok(gv.id, 'Giáo viên phải có id');
      assert.ok(gv.fullName, 'Giáo viên phải có fullName');
    });

    it('Báo cáo vận hành kiểm thực 3 bước đã được làm sạch chuỗi __WORKFLOW__', async () => {
      const res = await fetch(`${BASE_URL}/meal-operations/report?date=2026-11-05`, {
        headers: principalAuth.headers,
      });
      assert.equal(res.status, 200, 'API /meal-operations/report phải trả về 200');
      const body = await res.json();
      const step1Notes = body.data?.foodSafetyInspection?.step1RawCheck?.notes ?? '';

      // Tuyệt đối không chứa chuỗi kỹ thuật __WORKFLOW__
      assert.ok(!step1Notes.includes('__WORKFLOW__'), `Ghi chú kiểm thực không được chứa __WORKFLOW__: "${step1Notes}"`);
      assert.ok(!step1Notes.includes('__END__'), `Ghi chú kiểm thực không được chứa __END__: "${step1Notes}"`);
    });

    it('Hiệu trưởng có thể bật/tắt (toggle) trạng thái hoạt động của nhân sự', async () => {
      // Lấy 1 nhân sự không phải là tài khoản đang đăng nhập
      const staffRes = await fetch(`${BASE_URL}/users/staff?limit=10`, {
        headers: principalAuth.headers,
      });
      const staffList = (await staffRes.json()).data?.data || [];
      const target = staffList.find((s) => String(s.id) !== String(principalAuth.user?.id)) || { id: 10 };
      const targetId = target.id;

      // 1. Toggle lần 1
      const res1 = await fetch(`${BASE_URL}/users/staff/${targetId}/status`, {
        method: 'PATCH',
        headers: principalAuth.headers,
      });
      assert.equal(res1.status, 200, `PATCH /users/staff/${targetId}/status lần 1 phải thành công`);
      const body1 = await res1.json();
      assert.ok(body1.data?.status, 'Phải có trường status mới');

      // 2. Toggle lần 2 để khôi phục trạng thái ban đầu
      const res2 = await fetch(`${BASE_URL}/users/staff/${targetId}/status`, {
        method: 'PATCH',
        headers: principalAuth.headers,
      });
      assert.equal(res2.status, 200, `PATCH /users/staff/${targetId}/status lần 2 phải thành công`);
      const body2 = await res2.json();
      assert.notEqual(body2.data?.status, body1.data?.status, 'Status lần 2 phải đảo ngược lần 1');
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 2. CHUYÊN VIÊN DINH DƯỠNG (NUTRITIONIST)
  // ────────────────────────────────────────────────────────────────
  describe('Vai trò Chuyên viên Dinh dưỡng (NUTRITIONIST)', () => {
    let createdFoodId = null;

    it('Tạo nguyên liệu mới không bị lỗi NOT NULL của vi chất (phosphorus, sodium, vitamin)', async () => {
      const uniqueName = `Test Ngũ cốc dinh dưỡng ${Date.now()}`;
      const payload = {
        name: uniqueName,
        unit: 'g',
        energyKcal100g: 350.5,
        proteinG: 12.0,
        fatG: 4.5,
        carbG: 68.0,
        refuseRatePercent: 0,
        // Cố ý không gửi phosphorusMg, sodiumMg, vitaminAMcg, vitaminCMg
        // để kiểm tra backend tự động điền 0 thay vì để undefined gây lỗi Postgres
      };

      const res = await fetch(`${BASE_URL}/foods`, {
        method: 'POST',
        headers: nutritionistAuth.headers,
        body: JSON.stringify(payload),
      });

      assert.equal(res.status, 201, `POST /foods phải trả về 201 Created (tránh lỗi NOT NULL vi chất)`);
      const body = await res.json();
      assert.ok(body.data?.id, 'Nguyên liệu mới phải có ID');
      assert.equal(body.data.name, uniqueName);
      createdFoodId = body.data.id;
    });

    it('Cập nhật thông tin nguyên liệu đã tạo', async () => {
      assert.ok(createdFoodId, 'Cần có foodId từ test trước');
      const res = await fetch(`${BASE_URL}/foods/${createdFoodId}`, {
        method: 'PUT',
        headers: nutritionistAuth.headers,
        body: JSON.stringify({
          proteinG: 14.5,
          vitaminCMg: 25.0,
        }),
      });

      assert.equal(res.status, 200, 'PUT /foods/:id phải trả về 200');
      const body = await res.json();
      assert.equal(body.data?.proteinG, 14.5);
    });

    it('Tra cứu danh sách và danh mục nguyên liệu', async () => {
      const catRes = await fetch(`${BASE_URL}/foods/categories`, {
        headers: nutritionistAuth.headers,
      });
      assert.equal(catRes.status, 200);
      const catBody = await catRes.json();
      assert.ok(Array.isArray(catBody.data), 'Danh mục nguyên liệu phải là mảng');

      const listRes = await fetch(`${BASE_URL}/foods?limit=5`, {
        headers: nutritionistAuth.headers,
      });
      assert.equal(listRes.status, 200);
      const listBody = await listRes.json();
      assert.ok(listBody.data?.items?.length > 0, 'Danh sách nguyên liệu phải có dữ liệu');
    });

    it('Dọn dẹp xóa nguyên liệu test vừa tạo', async () => {
      if (!createdFoodId) return;
      const res = await fetch(`${BASE_URL}/foods/${createdFoodId}`, {
        method: 'DELETE',
        headers: nutritionistAuth.headers,
      });
      assert.equal(res.status, 200, 'DELETE /foods/:id phải thành công');
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 3. NHÂN VIÊN BẾP (KITCHEN_STAFF)
  // ────────────────────────────────────────────────────────────────
  describe('Vai trò Nhân viên Bếp (KITCHEN_STAFF)', () => {
    it('Lấy bảng điều phối KDS bếp cho ngày hiện tại', async () => {
      const res = await fetch(`${BASE_URL}/attendance/kitchen-kds`, {
        headers: kitchenAuth.headers,
      });
      assert.equal(res.status, 200, 'GET /attendance/kitchen-kds phải trả về 200');
      const body = await res.json();
      assert.ok(body.data?.classes, 'KDS phải có danh sách các lớp');
      assert.ok(Array.isArray(body.data.classes), 'classes phải là mảng');
    });

    it('Thực hiện Chia khay (PREPARING) và Xuất khay (DISPATCHED) thành công', async () => {
      // 1. Chia khay
      const res1 = await fetch(`${BASE_URL}/attendance/kitchen/status`, {
        method: 'POST',
        headers: kitchenAuth.headers,
        body: JSON.stringify({
          classId: '1',
          status: 'PREPARING',
          date: '2026-11-05',
        }),
      });
      assert.equal(res1.status, 201, 'POST /attendance/kitchen/status (PREPARING) phải trả về 201');
      const body1 = await res1.json();
      assert.equal(body1.data?.status, 'PREPARING');

      // 2. Xuất khay
      const res2 = await fetch(`${BASE_URL}/attendance/kitchen/status`, {
        method: 'POST',
        headers: kitchenAuth.headers,
        body: JSON.stringify({
          classId: '1',
          status: 'DISPATCHED',
          date: '2026-11-05',
        }),
      });
      assert.equal(res2.status, 201, 'POST /attendance/kitchen/status (DISPATCHED) phải trả về 201');
      const body2 = await res2.json();
      assert.equal(body2.data?.status, 'DISPATCHED');
    });

    it('Danh sách dị ứng của học sinh hiển thị tiếng Việt chuẩn, không bị lỗi font ???', async () => {
      const res = await fetch(`${BASE_URL}/children?allergyRisk=YES`, {
        headers: kitchenAuth.headers,
      });
      assert.equal(res.status, 200, 'GET /children?allergyRisk=YES phải trả về 200');
      const body = await res.json();
      const children = body.data?.items || body.data || [];
      assert.ok(children.length > 0, 'Phải có danh sách học sinh dị ứng');

      for (const child of children) {
        assert.ok(!child.fullName.includes('???'), `Tên bé không được có dấu ???: ${child.fullName}`);
        if (child.allergies) {
          for (const alg of child.allergies) {
            const note = alg.note || alg.allergenName || '';
            assert.ok(!note.includes('???'), `Ghi chú dị ứng không được có dấu ???: "${note}" của bé ${child.fullName}`);
          }
        }
      }
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 4. GIÁO VIÊN (TEACHER)
  // ────────────────────────────────────────────────────────────────
  describe('Vai trò Giáo viên (TEACHER)', () => {
    it('Giáo viên truy cập danh sách lớp học được phân công (đúng teacher boundary)', async () => {
      const res = await fetch(`${BASE_URL}/teacher/classes`, {
        headers: teacherAuth.headers,
      });
      assert.equal(res.status, 200, 'GET /teacher/classes phải trả về 200');
      const body = await res.json();
      const classes = body.data?.data || body.data?.items || body.data || [];
      assert.ok(Array.isArray(classes) && classes.length > 0, 'Giáo viên phải thấy lớp được phân công');

      // Kiểm tra danh sách học sinh của lớp
      const childRes = await fetch(`${BASE_URL}/teacher/children`, {
        headers: teacherAuth.headers,
      });
      assert.equal(childRes.status, 200, 'GET /teacher/children phải trả về 200');
    });

    it('Giáo viên truy vấn dữ liệu điểm danh bữa ăn của lớp được phân công', async () => {
      const res = await fetch(`${BASE_URL}/teacher/meal-attendance?date=2026-11-05`, {
        headers: teacherAuth.headers,
      });
      assert.equal(res.status, 200, 'GET /teacher/meal-attendance phải trả về 200');
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 5. PHỤ HUYNH (PARENT)
  // ────────────────────────────────────────────────────────────────
  describe('Vai trò Phụ huynh (PARENT)', () => {
    it('Xem thực đơn & sức ăn của con theo ngày', async () => {
      const res = await fetch(`${BASE_URL}/parent-evaluations/child-menu-consumption?date=2026-12-21`, {
        headers: parentAuth.headers,
      });
      assert.equal(res.status, 200, 'GET /parent-evaluations/child-menu-consumption phải trả về 200');
      const body = await res.json();
      assert.ok(body.data, 'Phụ huynh phải nhận được dữ liệu thực đơn & sức ăn');
    });

    it('Chi tiết món ăn có đầy đủ năng lượng Kcal, khẩu phần chuẩn và nguyên liệu', async () => {
      // Món ID 85: Bún bò huế, ngò gai, quế
      const res = await fetch(`${BASE_URL}/dishes/85`, {
        headers: parentAuth.headers,
      });
      assert.equal(res.status, 200, 'GET /dishes/85 phải trả về 200');
      const body = await res.json();
      const dish = body.data;
      assert.ok(dish, 'Phải có thông tin món ăn');
      assert.equal(dish.name, 'Bún bò huế, ngò gai, quế');

      // Kiểm tra năng lượng không bị rỗng/null
      const energy = dish.nutrition?.energyKcal ?? dish.nutrition?.calories;
      assert.ok(typeof energy === 'number' && energy > 0, `Năng lượng của món phải là số > 0, nhận được: ${energy}`);

      // Kiểm tra định lượng khẩu phần
      const portion = dish.portionSizeG ?? dish.standardServingSizeG ?? dish.nutrition?.portionSizeG;
      assert.ok(typeof portion === 'number' && portion > 0, `Khẩu phần phải là số > 0, nhận được: ${portion}`);

      // Kiểm tra thành phần nguyên liệu
      assert.ok(Array.isArray(dish.recipes) && dish.recipes.length > 0, 'Món ăn phải có danh sách nguyên liệu chế biến');
    });

    it('Xem thông tin hồ sơ tài khoản cá nhân phụ huynh', async () => {
      const res = await fetch(`${BASE_URL}/users/profile`, {
        headers: parentAuth.headers,
      });
      assert.equal(res.status, 200, 'GET /users/profile phải trả về 200');
      const body = await res.json();
      assert.ok(body.data?.fullName, 'Hồ sơ phụ huynh phải có họ tên');
    });
  });
});
