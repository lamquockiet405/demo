export function calculateGrossWeight(
  netGramsPerPortion: number,
  portions: number,
  refuseRatePercent: number,
) {
  if (
    ![netGramsPerPortion, portions, refuseRatePercent].every(Number.isFinite) ||
    netGramsPerPortion < 0 ||
    !Number.isSafeInteger(portions) ||
    portions < 0 ||
    refuseRatePercent < 0 ||
    refuseRatePercent >= 100
  ) {
    throw new Error(
      "Nhập định lượng không âm, số suất nguyên và hao hụt từ 0 đến dưới 100%.",
    );
  }
  const netGrams = netGramsPerPortion * portions;
  const grossGrams = netGrams / (1 - refuseRatePercent / 100);
  if (!Number.isFinite(netGrams) || !Number.isFinite(grossGrams))
    throw new Error(
      "Khối lượng tính toán quá lớn. Vui lòng kiểm tra thông số.",
    );
  return { netGrams, grossGrams, grossKg: grossGrams / 1000 };
}

export type SampleState = "STORED" | "DUE" | "DISPOSED" | "UNKNOWN";
export function getSampleState(
  sample: { status?: string; storedAt?: string | null },
  now = Date.now(),
): SampleState {
  if (sample.status === "DISPOSED") return "DISPOSED";
  if (!sample.storedAt || !Number.isFinite(Date.parse(sample.storedAt)))
    return "UNKNOWN";
  return now - Date.parse(sample.storedAt) >= 24 * 60 * 60 * 1000
    ? "DUE"
    : "STORED";
}

export function sampleDueAt(
  storedAt: string | null | undefined,
): string | null {
  if (!storedAt || !Number.isFinite(Date.parse(storedAt))) return null;
  const due = new Date(Date.parse(storedAt) + 86400000);
  return Number.isFinite(due.getTime()) ? due.toISOString() : null;
}

export function csvCell(value: unknown): string {
  let text = value == null ? "" : String(value);
  if (/^[\s]*[=+\-@]/.test(text) || /^[\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function makeCsv(rows: unknown[][]): string {
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export function downloadCsv(filename: string, rows: unknown[][]) {
  const url = URL.createObjectURL(
    new Blob([makeCsv(rows)], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const rowsOf = (value: any): any[] =>
  Array.isArray(value) ? value : Array.isArray(value?.items) ? value.items : [];
export const formatNumber = (value: unknown, digits = 1) =>
  value == null || value === "" || !Number.isFinite(Number(value))
    ? "—"
    : Number(value).toLocaleString("vi-VN", { maximumFractionDigits: digits });
export const formatDateTime = (value: string | null | undefined) =>
  !value || !Number.isFinite(Date.parse(value))
    ? "—"
    : new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

// Bound the three proof images together to fit the existing JSON upload API.
export async function prepareProofImage(file: File): Promise<string> {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 8 * 1024 * 1024
  )
    throw new Error("Chọn ảnh JPG, PNG hoặc WebP không quá 8 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    let size = 960;
    while (size >= 320) {
      const scale = Math.min(1, size / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Không xử lý được ảnh.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.82, 0.65, 0.45]) {
        const image = canvas.toDataURL("image/jpeg", quality);
        if (image.length <= 24000) return image;
      }
      size = Math.floor(size * 0.75);
    }
    throw new Error("Ảnh quá phức tạp. Vui lòng chọn ảnh cận cảnh rõ hơn.");
  } finally {
    bitmap.close();
  }
}
