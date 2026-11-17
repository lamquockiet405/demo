import { tenantApi } from '../api/tenant.api';
import { t } from '../i18n/language';
import { buildExcelWorkbook, excelFilename, ExcelSheet } from './excel-workbook';
export { studentHeaderRow } from './excel-workbook';

async function schoolBranding() {
  const local = {
    name: localStorage.getItem('school_name') || 'KidMeal',
    address: localStorage.getItem('school_address') || '',
    phone: localStorage.getItem('school_phone') || '',
    email: localStorage.getItem('school_email') || '',
    logoUrl: localStorage.getItem('school_logo') || '',
    color: localStorage.getItem('school_primary_color') || 'TEAL',
  };
  try {
    const profile = await tenantApi.getProfile();
    return { ...local, name: profile.name || local.name, address: profile.address || '', phone: profile.phone || '', email: profile.contactEmail || '',
      logoUrl: profile.branding?.logoUrl ?? local.logoUrl, color: profile.branding?.primaryColor || local.color };
  } catch { return local; }
}

async function schoolLogo(url: string) {
  if (!url) throw new Error('Trường chưa có logo. Vui lòng cập nhật logo trong Thông tin trường trước khi xuất Excel.');
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('Không tải được logo trường. Vui lòng kiểm tra logo trong Thông tin trường.');
  const objectUrl = URL.createObjectURL(await response.blob());
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    const scale = Math.min(1, 400 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Không xử lý được logo trường.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return { base64: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
  } finally { URL.revokeObjectURL(objectUrl); }
}

const exporting = new Set<string>();
export async function downloadExcelSheets(filename: string, title: string, sheets: ExcelSheet[], subtitle?: string): Promise<boolean> {
  const name = excelFilename(filename);
  if (exporting.has(name)) return false;
  exporting.add(name);
  try {
    const branding = await schoolBranding();
    const logo = await schoolLogo(branding.logoUrl);
    const workbook = await buildExcelWorkbook({ title: t(title), subtitle, sheets: sheets.map(sheet => ({ ...sheet,
      title: t(sheet.title || title), columns: sheet.columns?.map(col => ({ ...col, header: sheet.translateHeaders === false ? col.header : t(col.header) })),
      rows: sheet.columns || sheet.translateHeaders === false ? sheet.rows : sheet.rows.map((row, index) => index === 0 ? row.map(value => t(String(value ?? ''))) : row),
    })), school: { ...branding, color: ({ TEAL: '0F766E', YELLOW: '854D0E', ORANGE: 'C2410C' } as Record<string, string>)[branding.color] || '0F766E' }, logo });
    const buffer = await workbook.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buffer as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return true;
  } catch (error) {
    alert(t(error instanceof Error ? error.message : 'Không thể xuất Excel. Vui lòng thử lại.'));
    return false;
  } finally { exporting.delete(name); }
}

export function downloadExcel(filename: string, rows: unknown[][], title?: string) {
  const reportTitles: [string, string][] = [
    ['danh-sach-che-do-an', 'Danh sách dị ứng và chế độ ăn'],
    ['nhat-ky-kiem-thuc', 'Nhật ký kiểm thực ba bước'],
    ['ke-hoach-suat-an', 'Kế hoạch suất ăn hằng ngày'],
    ['an-sang-', 'Danh sách đăng ký ăn sáng'],
    ['bao-cao-luu-mau', 'Báo cáo lưu mẫu an toàn thực phẩm'],
    ['bao-cao-the-chat', 'Báo cáo phát triển thể chất WHO'],
  ];
  const inferred = reportTitles.find(([prefix]) => filename.startsWith(prefix))?.[1];
  return downloadExcelSheets(filename, title || inferred || filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '), [{ rows }]);
}

const labels: Record<string, string> = {
  schoolName: 'Tên trường', title: 'Tiêu đề', date: 'Ngày', month: 'Tháng', year: 'Năm', name: 'Tên', fullName: 'Họ và tên',
  studentName: 'Học sinh', childName: 'Học sinh', studentCode: 'Mã học sinh', className: 'Lớp', classId: 'Mã lớp',
  parentName: 'Phụ huynh', teacherName: 'Giáo viên', mealType: 'Bữa ăn', rating: 'Số sao', content: 'Nội dung', comment: 'Ý kiến',
  status: 'Trạng thái', notes: 'Ghi chú', note: 'Ghi chú', createdAt: 'Ngày tạo', updatedAt: 'Ngày cập nhật',
  report: 'Báo cáo', summary: 'Tổng hợp', kpis: 'Chỉ số tổng hợp', items: 'Chi tiết', rows: 'Chi tiết', data: 'Dữ liệu',
  totalStudents: 'Tổng học sinh', totalChildren: 'Tổng học sinh', totalClasses: 'Tổng lớp', totalFeedbacks: 'Tổng ý kiến',
  normalCount: 'Thể trạng bình thường', underweightCount: 'Suy dinh dưỡng', stuntedCount: 'Thấp còi', overweightObeseCount: 'Thừa cân, béo phì',
  gradeBreakdown: 'Theo khối lớp', historicalTrends: 'Xu hướng thể trạng', gradeName: 'Khối lớp', evaluatedStudents: 'Học sinh đã đánh giá',
  normalRate: 'Tỷ lệ bình thường (%)', averageRating: 'Điểm trung bình', responseRate: 'Tỷ lệ phản hồi (%)',
  inspection3Step: 'Kiểm thực ba bước', photoAuditTrail: 'Ảnh minh chứng', sampleRetention24h: 'Lưu mẫu thực phẩm',
  totalInspections: 'Tổng biên bản', withPhotoCount: 'Biên bản có ảnh', totalSamplesStored: 'Tổng mẫu lưu',
  inspections: 'Biên bản kiểm thực', samples: 'Mẫu lưu', dishName: 'Món ăn', sampleCode: 'Mã mẫu', storedAt: 'Ngày lưu mẫu',
  disposedAt: 'Ngày hủy mẫu', performerName: 'Người thực hiện', inspectorName: 'Người kiểm thực', approvalStatus: 'Trạng thái duyệt',
  step1Status: 'Bước 1', step2Status: 'Bước 2', step3Status: 'Bước 3', mealDate: 'Ngày phục vụ', mealTime: 'Bữa ăn',
  responseContent: 'Nội dung phản hồi', feedbackDate: 'Ngày đánh giá', category: 'Nhóm', count: 'Số lượng', percentage: 'Tỷ lệ (%)',
  class: 'Lớp', id: 'Mã', studentId: 'Mã học sinh', childId: 'Mã học sinh', startDate: 'Từ ngày', endDate: 'Đến ngày', period: 'Kỳ báo cáo', periodTitle: 'Kỳ báo cáo',
  overallCsat: 'Mức độ hài lòng', totalEvaluations: 'Tổng đánh giá', positiveRate: 'Tỷ lệ tích cực (%)', positiveCount: 'Số đánh giá tích cực',
  negativeRate: 'Tỷ lệ tiêu cực (%)', negativeCount: 'Số đánh giá tiêu cực', isNegativeAlert: 'Cảnh báo đánh giá tiêu cực',
  participationRate: 'Tỷ lệ tham gia (%)', totalEnrolledStudents: 'Tổng học sinh', respondingParentsCount: 'Phụ huynh đã đánh giá', benchmarkTargetText: 'Mục tiêu',
  qualityDimensions: 'Đánh giá chất lượng', dimensionKey: 'Mã tiêu chí', vietnameseTitle: 'Tiêu chí', questionPrompt: 'Nội dung khảo sát',
  averageScore: 'Điểm trung bình', satisfactionRate: 'Tỷ lệ hài lòng (%)', sampleFeedbackCount: 'Số ý kiến', representativeRemarks: 'Ý kiến tiêu biểu',
  dishRanking: 'Xếp hạng món ăn', topFavoriteDishes: 'Món được yêu thích', topComplainedDishes: 'Món cần cải thiện',
  categoryName: 'Nhóm món', feedbackCount: 'Số ý kiến', complaintCount: 'Số phản ánh', praiseCount: 'Số lời khen', primaryComment: 'Ý kiến nổi bật',
  actionRequired: 'Hướng xử lý', actionNote: 'Ghi chú xử lý', slaPerformance: 'Tiến độ phản hồi', totalReceived: 'Tổng ý kiến nhận', respondedCount: 'Đã phản hồi',
  pendingCount: 'Chờ phản hồi', averageResponseHours: 'Thời gian phản hồi trung bình (giờ)', urgentSlaAvgHours: 'Phản hồi khẩn cấp trung bình (giờ)',
  normalSlaAvgHours: 'Phản hồi thường trung bình (giờ)', overdueSlaCount: 'Số ý kiến quá hạn', urgentPendingCount: 'Ý kiến khẩn cấp chờ xử lý',
  overdueItems: 'Ý kiến quá hạn', recentFeedbacks: 'Ý kiến gần đây', hoursElapsed: 'Thời gian đã chờ (giờ)', slaTargetHours: 'Hạn phản hồi (giờ)',
  isUrgent: 'Khẩn cấp', isOverdue: 'Quá hạn', repliedAt: 'Thời gian phản hồi', respondedByName: 'Người phản hồi',
  recipeImprovements: 'Cải thiện công thức', issueFeedback: 'Vấn đề cần cải thiện', actionPlan: 'Kế hoạch xử lý', priority: 'Ưu tiên',
  createdByName: 'Người tạo', createdByRole: 'Vai trò người tạo', respondingStudents: 'Học sinh có đánh giá', pendingIssueCount: 'Vấn đề chờ xử lý',
  teacherDisciplineScore: 'Đánh giá thực hiện', description: 'Mô tả', executiveActions: 'Hoạt động điều hành', recommendedAmountVnd: 'Kinh phí đề xuất (VND)',
  underweightRate: 'Tỷ lệ nhẹ cân (%)', stuntedRate: 'Tỷ lệ thấp còi (%)', overweightRate: 'Tỷ lệ thừa cân (%)', overweightObeseRate: 'Tỷ lệ thừa cân, béo phì (%)',
  normalTarget: 'Mục tiêu bình thường (%)', underweightTarget: 'Mục tiêu nhẹ cân (%)', stuntedTarget: 'Mục tiêu thấp còi (%)', overweightObeseTarget: 'Mục tiêu thừa cân, béo phì (%)',
  normalStatus: 'Trạng thái thể trạng bình thường', underweightStatus: 'Trạng thái nhẹ cân', stuntedStatus: 'Trạng thái thấp còi', overweightObeseStatus: 'Trạng thái thừa cân, béo phì',
  menuComplianceRate: 'Tỷ lệ thực đơn đạt chuẩn (%)', menuComplianceStatus: 'Trạng thái thực đơn', reportPeriod: 'Kỳ báo cáo', targetDate: 'Ngày báo cáo',
  overallComplianceRate: 'Tỷ lệ tuân thủ (%)', zeroDefectStatus: 'Trạng thái tuân thủ', decisionStandard: 'Tiêu chuẩn',
  step1RawCheckCompliance: 'Tuân thủ bước 1 (%)', step2ProcessingCheckCompliance: 'Tuân thủ bước 2 (%)', step3PreServingCheckCompliance: 'Tuân thủ bước 3 (%)',
  photoRate: 'Tỷ lệ có ảnh (%)', isCompliant: 'Đạt yêu cầu', threshold: 'Ngưỡng yêu cầu', samplePhotos: 'Ảnh minh chứng', step: 'Bước kiểm thực', imageUrl: 'Đường dẫn ảnh', uploadedAt: 'Ngày tải ảnh',
  temperatureLogs: 'Theo dõi nhiệt độ', avgTransportTempC: 'Nhiệt độ vận chuyển trung bình (°C)', avgCoreBoilingTempC: 'Nhiệt độ chế biến trung bình (°C)',
  minCoreBoilingTempC: 'Nhiệt độ chế biến thấp nhất (°C)', coreTempThreshold: 'Ngưỡng nhiệt độ (°C)', sampleRetentionRate: 'Tỷ lệ lưu mẫu (%)',
  standardWeightComplianceRate: 'Tỷ lệ đạt khối lượng mẫu (%)', fridgeStatus: 'Tủ lưu mẫu', unitName: 'Tên tủ', currentTempC: 'Nhiệt độ hiện tại (°C)',
  standardRange: 'Khoảng tiêu chuẩn', powerStatus: 'Trạng thái nguồn điện', isRedAlert: 'Cảnh báo khẩn cấp', hourlyTrend: 'Nhiệt độ theo giờ', hour: 'Giờ', tempC: 'Nhiệt độ (°C)',
  weightOrVolume: 'Khối lượng / thể tích', isStandard: 'Đạt chuẩn', disposeAt: 'Ngày hủy mẫu', tripartiteSigned: 'Đủ chữ ký xác nhận',
  legalAndCertificates: 'Giấy phép và chứng nhận', schoolFoodSafetyLicense: 'Giấy phép an toàn thực phẩm', certNumber: 'Số chứng nhận',
  issueDate: 'Ngày cấp', expiryDate: 'Ngày hết hạn', daysRemaining: 'Số ngày còn lại', staffCompliance: 'Tuân thủ của nhân viên',
  totalKitchenStaff: 'Tổng nhân viên bếp', validHealthCardCount: 'Giấy khám sức khỏe còn hạn', healthCardRate: 'Tỷ lệ đủ giấy sức khỏe (%)',
  validTrainingCertCount: 'Chứng nhận tập huấn còn hạn', trainingCertRate: 'Tỷ lệ tập huấn (%)', suppliers: 'Nhà cung cấp', sensoryIncidents: 'Sự cố cảm quan',
};
function label(key: string) { return labels[key] || t(key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ')); }

export function reportSheets(data: unknown): ExcelSheet[] {
  const sheets: ExcelSheet[] = [];
  const flat = (value: any, prefix = '', out: Record<string, unknown> = {}) => {
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      for (const [key, item] of Object.entries(value)) flat(item, prefix ? `${prefix} / ${label(key)}` : label(key), out);
    } else out[prefix || 'Giá trị'] = Array.isArray(value) ? value.map(item => item && typeof item === 'object' ? Object.entries(flat(item)).map(([k, v]) => `${k}: ${v ?? ''}`).join('; ') : String(item ?? '')).join('\n') : value;
    return out;
  };
  const visit = (value: any, path: string) => {
    if (Array.isArray(value)) {
      const records = value.map(item => flat(item));
      const headers = [...new Set(records.flatMap(item => Object.keys(item)))];
      sheets.push({ name: path, title: path, rows: [headers.length ? headers : ['Không có dữ liệu'], ...records.map(record => headers.map(key => record[key]))] });
    } else if (value && typeof value === 'object' && !(value instanceof Date)) {
      const scalars = Object.entries(value).filter(([, item]) => item == null || typeof item !== 'object' || item instanceof Date);
      if (scalars.length) sheets.push({ name: path, title: path, rows: [['Thông tin', 'Giá trị'], ...scalars.map(([key, item]) => [label(key), item])] });
      for (const [key, item] of Object.entries(value)) if (item && typeof item === 'object' && !(item instanceof Date)) visit(item, path === 'Tổng hợp' ? label(key) : `${path} - ${label(key)}`);
    } else sheets.push({ name: path, rows: [['Thông tin', 'Giá trị'], [path, value]] });
  };
  visit(data, 'Tổng hợp');
  return sheets.length ? sheets : [{ name: 'Tổng hợp', rows: [['Thông tin', 'Giá trị']] }];
}

export function downloadReportExcel(filename: string, title: string, data: unknown, subtitle?: string) {
  return downloadExcelSheets(filename, title, reportSheets(data).map((sheet, index) => ({ ...sheet, title: index === 0 ? title : `${title} - ${sheet.title || sheet.name}` })), subtitle);
}
