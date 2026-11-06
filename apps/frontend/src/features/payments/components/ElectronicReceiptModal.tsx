import { t as translateText, getLocale } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React from 'react';
import { ElectronicReceiptData } from '../api/vnpay.api';
import {
  X,
  Printer,
  Download,
  CheckCircle2,
  Building,
  ShieldCheck,
  QrCode,
} from 'lucide-react';

interface ElectronicReceiptModalProps {
  receipt: ElectronicReceiptData | null;
  onClose: () => void;
}

export const ElectronicReceiptModal: React.FC<ElectronicReceiptModalProps> = ({
  receipt,
  onClose,
}) => {
  useLanguage();
  if (!receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 my-8">
        {/* Modal Top Bar (Hidden during print) */}
        <div className="flex items-center justify-between border-b pb-4 print:hidden">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">{translateText("Biên Lai Điện Tử Chính Thức")}</span>
            <span className="text-xs text-slate-500 font-mono">
              {translateText(receipt.receiptNumber)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
            >
              <Printer className="w-3.5 h-3.5" />{translateText("In biên lai")}</button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Official Receipt Printable Content */}
        <div className="space-y-6 text-slate-800" id="printable-receipt">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-dashed border-slate-200 pb-4">
            <div>
              <div className="flex items-center gap-2 text-teal-800 font-black text-lg">
                <Building className="w-5 h-5 text-teal-600" />
                {receipt.schoolName}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{receipt.schoolAddress}</p>
              <p className="text-xs text-slate-500">{translateText("MST: ")}<span className="font-mono font-medium">{receipt.schoolTaxCode}</span>{translateText(" • Hotline:")}{' '}
                {translateText(receipt.schoolHotline)}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">{translateText("Mẫu số: 01-BL-MN")}</span>
              <span className="text-sm font-black font-mono text-teal-700">
                {translateText(receipt.receiptNumber)}
              </span>
              <span className="text-[10px] text-slate-400 block">{translateText("Mã HĐ: ")}{receipt.invoiceCode}
              </span>
            </div>
          </div>

          {/* Title */}
          <div className="text-center space-y-1">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">{translateText("BIÊN LAI THU TIỀN ĐIỆN TỬ")}</h2>
            <p className="text-xs text-slate-500 font-medium">{translateText("(Dịch vụ suất ăn xế dinh dưỡng 17h00 - Thỏa thuận bán trú ngoài giờ)")}</p>
          </div>

          {/* Student & Payer Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 rounded-2xl p-4 text-xs">
            <div className="space-y-1.5">
              <p className="text-slate-500 font-medium">{translateText("Thông tin học sinh:")}</p>
              <p className="font-bold text-slate-900 text-sm">
                {receipt.student.fullName}
              </p>
              <p className="text-slate-600">{translateText("Lớp: ")}<span className="font-semibold text-slate-800">{receipt.student.className}</span> (
                {translateText(receipt.student.gradeLevel)})
              </p>
              <p className="text-slate-600">{translateText("Mã học sinh: ")}<span className="font-mono font-semibold">{receipt.student.studentCode}</span>
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="text-slate-500 font-medium">{translateText("Người nộp tiền (Phụ huynh):")}</p>
              <p className="font-bold text-slate-900 text-sm">{receipt.payer.fullName}</p>
              <p className="text-slate-600">{translateText("Số điện thoại: ")}<span className="font-mono">{translateText(receipt.payer.phoneNumber)}</span>
              </p>
              <p className="text-slate-600">{translateText("Quan hệ: ")}{translateText(receipt.payer.relation)}</p>
            </div>
          </div>

          {/* Service Details Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 uppercase font-semibold">
                <tr>
                  <th className="py-2.5 px-3">{translateText("Khoản thu dịch vụ")}</th>
                  <th className="py-2.5 px-3 text-center">{translateText("Số ngày")}</th>
                  <th className="py-2.5 px-3 text-right">{translateText("Đơn giá / ngày")}</th>
                  <th className="py-2.5 px-3 text-right">{translateText("Thành tiền")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-3 px-3">
                    <span className="font-bold text-slate-800 block">
                      {receipt.serviceDetails.periodName}
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      {receipt.serviceDetails.serviceName}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center font-bold text-slate-800">
                    {receipt.serviceDetails.servingDays}{translateText(" ngày")}</td>
                  <td className="py-3 px-3 text-right font-medium text-slate-700">
                    {translateText(receipt.serviceDetails.unitPricePerDay.toLocaleString(getLocale()))}{translateText(" đ")}</td>
                  <td className="py-3 px-3 text-right font-black text-slate-900">
                    {translateText(receipt.serviceDetails.totalAmount.toLocaleString(getLocale()))}{translateText(" đ")}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Amount In Words */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-xs gap-2">
            <div>
              <span className="text-slate-500">{translateText("Số tiền bằng chữ: ")}</span>
              <span className="font-bold text-emerald-900 italic">
                {translateText(receipt.serviceDetails.amountInWords)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 text-[11px] block">{translateText("Tổng cộng:")}</span>
              <span className="text-lg font-black text-emerald-700">
                {translateText(receipt.serviceDetails.totalAmount.toLocaleString(getLocale()))}{translateText(" VNĐ")}</span>
            </div>
          </div>

          {/* Transaction Metadata & Stamp */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center pt-2 border-t border-dashed border-slate-200 text-xs">
            <div className="space-y-1">
              <p className="text-slate-500 font-medium">{translateText("Chi tiết thanh toán điện tử:")}</p>
              <p className="text-slate-700">{translateText("Phương thức: ")}<strong className="text-slate-900">{translateText(receipt.paymentInfo.paymentMethod)}</strong>
              </p>
              <p className="text-slate-700 font-mono">{translateText("Mã chuẩn chi VNPAY: ")}<strong>{translateText(receipt.paymentInfo.vnpayTransactionNo)}</strong>
              </p>
              <p className="text-slate-700 font-mono">{translateText("Ngân hàng: ")}<strong>{receipt.paymentInfo.bankCode}</strong>{translateText(" • Mã GD:")}{' '}
                <strong>{translateText(receipt.paymentInfo.bankTransactionNo)}</strong>
              </p>
              <p className="text-slate-500 text-[11px]">{translateText("Thời gian: ")}{translateText(new Date(receipt.paymentInfo.payDate).toLocaleString(getLocale()))}
              </p>
            </div>

            {/* Digital Stamp Representation */}
            <div className="flex justify-end">
              <div className="border-2 border-dashed border-emerald-600 rounded-2xl p-3 w-48 text-center space-y-1 bg-emerald-50/50 shadow-inner">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
                <span className="text-[11px] font-black uppercase text-emerald-800 tracking-wider block">{translateText("ĐÃ THU TIỀN")}</span>
                <span className="text-[9px] text-emerald-700 font-medium block">{translateText("Cổng VNPAY Xác Thực Ký Số")}</span>
                <span className="text-[8px] text-slate-400 font-mono block truncate">{translateText("Hash: ")}{translateText(receipt.digitalSignature.verificationHash.slice(0, 16))}...
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t print:hidden">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition"
          >{translateText("Đóng")}</button>
          <button
            onClick={handlePrint}
            className="px-6 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white text-sm font-bold rounded-xl shadow-md transition flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />{translateText("In & Tải Biên Lai PDF")}</button>
        </div>
      </div>
    </div>
  );
};

