export function validateStudentRows(
  rows: Record<string, any>[],
  classIds: string[],
  today: string,
) {
  if (!rows.length) throw new Error("Tệp không có dữ liệu học sinh.");
  if (rows.length > 1000)
    throw new Error("Mỗi lần nhập tối đa 1.000 học sinh.");
  const codes = new Set<string>();
  return rows.map((row, i) => {
    const fail = (message: string) => {
      throw new Error(`Dòng ${i + 2}: ${message}`);
    };

    const fullName = String(
      row.fullName ||
      row["Họ và tên (*)"] ||
      row["Họ và tên"] ||
      row["Họ tên"] ||
      row["Họ tên học sinh"] ||
      ""
    ).trim();

    let rawDob = String(
      row.dateOfBirth ||
      row["Ngày sinh (YYYY-MM-DD) (*)"] ||
      row["Ngày sinh (*)"] ||
      row["Ngày sinh"] ||
      ""
    ).trim();

    // Định dạng DD/MM/YYYY sang YYYY-MM-DD nếu cần
    if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(rawDob)) {
      const parts = rawDob.split(/[\/\-]/);
      rawDob = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    }

    let rawGender = String(
      row.gender ||
      row["Giới tính (Nam/Nữ) (*)"] ||
      row["Giới tính (*)"] ||
      row["Giới tính"] ||
      ""
    ).trim().toUpperCase();

    if (["NAM", "TRAI", "BOY", "MALE", "M"].includes(rawGender)) {
      rawGender = "MALE";
    } else if (["NỮ", "NU", "GÁI", "GAI", "GIRL", "FEMALE", "F"].includes(rawGender)) {
      rawGender = "FEMALE";
    }

    const classId = String(
      row.classId !== undefined && row.classId !== ""
        ? row.classId
        : row["Mã lớp (*)"] ||
          row["Mã lớp"] ||
          ""
    ).trim();

    const studentCode = String(
      row.studentCode ||
      row["Mã học sinh (*)"] ||
      row["Mã học sinh"] ||
      row["Mã học sinh (Tùy chọn)"] ||
      row["Mã HS"] ||
      ""
    ).trim();

    const date = new Date(`${rawDob}T00:00:00Z`);

    if (!fullName) fail("Thiếu họ tên học sinh.");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(rawDob) ||
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== rawDob ||
      rawDob > today
    )
      fail("Ngày sinh phải hợp lệ, đúng định dạng YYYY-MM-DD (hoặc DD/MM/YYYY) và không ở tương lai.");
    if (!["MALE", "FEMALE"].includes(rawGender))
      fail("Giới tính phải là MALE (Nam) hoặc FEMALE (Nữ).");
    if (!classIds.includes(classId))
      fail(`Mã lớp "${classId}" không tồn tại trong danh sách lớp của trường.`);
    if (studentCode) {
      const codeKey = studentCode.toLowerCase();
      if (codes.has(codeKey))
        fail(`Mã học sinh "${studentCode}" bị trùng lặp trong tệp.`);
      codes.add(codeKey);
    }

    const parentName = String(
      row.parentName ||
      row.emergencyContactName ||
      row["Họ tên phụ huynh"] ||
      row["Tên phụ huynh"] ||
      row["Phụ huynh"] ||
      ""
    ).trim();

    const parentPhone = String(
      row.parentPhone ||
      row.emergencyContactPhone ||
      row["SĐT phụ huynh"] ||
      row["Số điện thoại phụ huynh"] ||
      row["Số điện thoại"] ||
      ""
    ).trim();

    const parentEmail = String(
      row.parentEmail ||
      row["Email phụ huynh"] ||
      row["Email"] ||
      ""
    ).trim();

    let parentRelationship = String(
      row.parentRelationship ||
      row["Mối quan hệ"] ||
      row["Mối quan hệ (Bố/Mẹ/Giám hộ)"] ||
      "FATHER"
    ).trim().toUpperCase();

    if (["BỐ", "CHA", "BA", "FATHER"].includes(parentRelationship)) parentRelationship = "FATHER";
    else if (["MẸ", "ME", "MOTHER"].includes(parentRelationship)) parentRelationship = "MOTHER";
    else if (["NGƯỜI GIÁM HỘ", "GIÁM HỘ", "GUARDIAN"].includes(parentRelationship)) parentRelationship = "GUARDIAN";
    else parentRelationship = "FATHER";

    return {
      fullName,
      dateOfBirth: rawDob,
      gender: rawGender as "MALE" | "FEMALE",
      classId: Number(classId),
      studentCode: studentCode || undefined,
      parentName: parentName || undefined,
      parentEmail: parentEmail || undefined,
      parentPhone: parentPhone || undefined,
      parentRelationship,
      emergencyContactName: parentName,
      emergencyContactPhone: parentPhone,
    };
  });
}
