export function validateStudentRows(
  rows: Record<string, any>[],
  classIds: string[],
  today: string,
) {
  if (!rows.length) throw new Error("Tệp không có học sinh.");
  if (rows.length > 1000)
    throw new Error("Mỗi lần nhập tối đa 1.000 học sinh.");
  const codes = new Set<string>();
  return rows.map((row, i) => {
    const fullName = String(row.fullName || "").trim();
    const dateOfBirth = String(row.dateOfBirth || "").trim();
    const gender = String(row.gender || "")
      .trim()
      .toUpperCase();
    const classId = String(row.classId || "").trim();
    const studentCode = String(row.studentCode || "").trim();
    const date = new Date(`${dateOfBirth}T00:00:00Z`);
    const fail = (message: string) => {
      throw new Error(`Dòng ${i + 2}: ${message}`);
    };
    if (!fullName) fail("Thiếu họ tên học sinh.");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) ||
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== dateOfBirth ||
      dateOfBirth > today
    )
      fail("Ngày sinh phải hợp lệ, đúng định dạng YYYY-MM-DD và không ở tương lai.");
    if (!["MALE", "FEMALE"].includes(gender))
      fail("Giới tính phải là MALE (Nam) hoặc FEMALE (Nữ).");
    if (!classIds.includes(classId))
      fail("Lớp học không tồn tại hoặc chưa được chọn.");
    if (studentCode && codes.has(studentCode))
      fail("Mã học sinh bị trùng lặp trong tệp.");
    if (studentCode) codes.add(studentCode);

    const parentName = String(row.parentName || row.emergencyContactName || "").trim();
    const parentPhone = String(row.parentPhone || row.emergencyContactPhone || "").trim();
    const parentEmail = String(row.parentEmail || "").trim();

    return {
      fullName,
      dateOfBirth,
      gender,
      classId: Number(classId),
      studentCode: studentCode || undefined,
      parentName: parentName || undefined,
      parentEmail: parentEmail || undefined,
      parentPhone: parentPhone || undefined,
      parentRelationship: String(row.parentRelationship || "FATHER").trim(),
      emergencyContactName: parentName,
      emergencyContactPhone: parentPhone,
      medicalNotes: String(row.medicalNotes || "").trim(),
    };
  });
}
