/**
 * Ghi chú kiểm thực có thể chứa metadata phê duyệt nội bộ dạng
 * `__WORKFLOW__:{...}:__END__ <ghi chú>`. Hàm này loại bỏ metadata đó để
 * không bao giờ hiển thị chuỗi kỹ thuật cho người dùng.
 */
export function stripWorkflowMeta(raw?: string | null): string {
  return String(raw ?? '')
    .replace(/__WORKFLOW__:.*?:__END__\s*/gs, '')
    .trim();
}

