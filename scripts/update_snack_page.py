path = r'apps/frontend/src/features/payments/pages/ParentSnackPaymentPage.tsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# Replace toBreakfastText
old_fn = '''const toBreakfastText = (text?: string) => {
  if (!text) return "";
  return text
    .replace(/Suất ăn xế nhẹ lúc 17h00/gi, "Suất ăn sáng dinh dưỡng lúc 07h00")
    .replace(/Ăn Xế Chiều 17h/gi, "Suất Ăn Sáng 07h")
    .replace(/Ăn Xế Chiều/gi, "Suất Ăn Sáng")
    .replace(/Ăn xế chiều/gi, "Suất ăn sáng")
    .replace(/Ăn Xế/g, "Suất Ăn Sáng")
    .replace(/Ăn xế/g, "Suất ăn sáng")
    .replace(/ăn xế/gi, "suất ăn sáng")
    .replace(/bữa xế/gi, "bữa sáng")
    .replace(/16:30 - 17:00/g, "07:00 - 07:45")
    .replace(/17h00/gi, "07h00")
    .replace(/17h/gi, "07h");
};'''

new_fn = '''const toBreakfastText = (text?: string) => text || "";'''

text = text.replace(old_fn.replace('\r\n', '\n'), new_fn)
text = text.replace(old_fn, new_fn)

# Replace breakfast occurrences with snack (ăn xế)
text = text.replace('Gói Dịch Vụ Suất Ăn Sáng & Thanh Toán VNPAY', 'Gói Dịch Vụ Suất Ăn Xế & Thanh Toán')
text = text.replace('Lịch Ăn Sáng & Thực Đơn Bữa Sáng Của Bé', 'Lịch Ăn Xế & Thực Đơn Bữa Xế Của Bé')
text = text.replace('Lịch Ăn Sáng Chỉ Hiển Thị Khi Đã Đóng Tiền', 'Lịch Ăn Xế Chỉ Hiển Thị Khi Đã Đăng Ký')
text = text.replace('Đóng tiền suất ăn sáng ngay để xem thực đơn & gửi bếp', 'Đăng ký suất ăn xế ngay để xem thực đơn & gửi bếp')
text = text.replace('Gói Suất Ăn Sáng Dinh Dưỡng', 'Gói Suất Ăn Xế Dinh Dưỡng')
text = text.replace('Gói Dịch Vụ Suất Ăn Sáng Đã Công Bố & Đang Mở Đăng Ký', 'Gói Dịch Vụ Suất Ăn Xế Đã Công Bố & Đang Mở Đăng Ký')
text = text.replace('Không tìm thấy gói suất ăn sáng phù hợp', 'Không tìm thấy gói suất ăn xế phù hợp')
text = text.replace('gói dịch vụ suất ăn sáng mới', 'gói dịch vụ suất ăn xế mới')
text = text.replace('Đã Mở Lịch Ăn Sáng', 'Đã Mở Lịch Ăn Xế')
text = text.replace('Số ngày ăn sáng', 'Số ngày ăn xế')
text = text.replace('điểm danh ăn sáng', 'điểm danh ăn xế')
text = text.replace('Lịch ăn sáng của gói này', 'Lịch ăn xế của gói này')
text = text.replace('gói ăn sáng', 'gói ăn xế')
text = text.replace('hóa đơn ăn sáng', 'hóa đơn ăn xế')
text = text.replace('suất ăn sáng', 'suất ăn xế')

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print('Updated ParentSnackPaymentPage successfully!')
