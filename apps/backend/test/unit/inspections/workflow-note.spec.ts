import { stripWorkflowMeta } from '../../../src/modules/inspections/utils/workflow-note.util';

/**
 * Unit test: làm sạch ghi chú kiểm thực 3 bước (không lộ metadata __WORKFLOW__).
 */
describe('stripWorkflowMeta (Ghi chú kiểm thực 3 bước)', () => {
  it('loại bỏ khối metadata phê duyệt và giữ lại ghi chú người dùng', () => {
    const raw =
      '__WORKFLOW__:{"approvalStatus":"DA_DUYET","dishes":[],"kitchenSubmittedAt":"2026-11-05T12:52:02.271Z","approvedBy":"Nguyễn Thị Mai Hương"}:__END__ 1';
    expect(stripWorkflowMeta(raw)).toBe('1');
  });

  it('giữ nguyên tiếng Việt có dấu trong ghi chú', () => {
    expect(stripWorkflowMeta('__WORKFLOW__:{"dishes":["Canh chua"]}:__END__ Rau tươi, đạt chuẩn')).toBe('Rau tươi, đạt chuẩn');
  });

  it('trả chuỗi rỗng khi chỉ có metadata', () => {
    expect(stripWorkflowMeta('__WORKFLOW__:{"a":1}:__END__')).toBe('');
  });

  it('xử lý null/undefined/chuỗi rỗng', () => {
    expect(stripWorkflowMeta(null)).toBe('');
    expect(stripWorkflowMeta(undefined)).toBe('');
    expect(stripWorkflowMeta('')).toBe('');
  });

  it('không thay đổi ghi chú bình thường', () => {
    expect(stripWorkflowMeta('  Nhiệt độ lõi 80°C  ')).toBe('Nhiệt độ lõi 80°C');
  });

  it('loại bỏ nhiều khối metadata và metadata xuống dòng', () => {
    const raw = '__WORKFLOW__:{"a":\n1}:__END__ __WORKFLOW__:{"b":2}:__END__ Đạt';
    expect(stripWorkflowMeta(raw)).toBe('Đạt');
  });
});

