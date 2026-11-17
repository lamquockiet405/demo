/**
 * Loại bỏ metadata phê duyệt nội bộ `__WORKFLOW__:{...}:__END__` khỏi ghi chú
 * kiểm thực trước khi hiển thị hoặc xuất báo cáo.
 */
export function sanitizeInspectionNote(raw?: string | null): string {
  return String(raw ?? "")
    .replace(/__WORKFLOW__:[\s\S]*?:__END__\s*/g, "")
    .trim();
}

