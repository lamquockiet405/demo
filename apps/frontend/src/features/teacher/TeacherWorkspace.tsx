import { t as translateText } from '../../core/i18n/language';
import { useLanguage } from '../../core/i18n/useLanguage';
import React, { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { apiClient } from '../../core/api/axios';
import { DateInput } from '../../core/components/DateInput';
import { downloadExcel } from '../../core/utils/excel-export';
import { schoolDate } from '../menus/utils/published-menus';
import { Feedback, Field, Modal, SchoolPage, State, useSchoolAction, useSchoolResource } from '../school/components/SchoolUI';
import { TeacherStatsOverview } from './components/TeacherStatsOverview';
import { FileSpreadsheet } from 'lucide-react';

const get = async (path: string, params?: any) => (await apiClient.get('/teacher/' + path, { params })).data;
export const mealLabels: Record<string, string> = {
  BREAKFAST: 'Buổi sáng',
  LUNCH: 'Bữa trưa chính',
  AFTERNOON_SNACK: 'Buổi phụ',
  LATE_SNACK: 'Buổi xế chiều',
};
export const stateLabels: Record<string, string> = { FULL: 'Ăn hết', ALL: 'Ăn hết', MOST: 'Ăn phần lớn', HALF: 'Ăn một nửa', PARTIAL: 'Ăn một phần (dữ liệu cũ)', LITTLE: 'Ăn ít', FEW: 'Ăn ít', NONE: 'Không ăn' };
function useClasses() { return useSchoolResource<any[]>(() => get('classes'), []); }

function Filters({ classes, classId, setClassId, date, setDate, meal, setMeal, search, setSearch, onReload, onExport }: any) {
  useLanguage();
  return (
    <div className="kp-filters flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        {setDate && (
          <Field label={translateText("Ngày")}>
            <input aria-label={translateText("Ngày giáo viên")} type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)} />
          </Field>
        )}
        <select aria-label={translateText("Lớp phụ trách")} value={classId} onChange={e => setClassId(e.target.value)}>
          <option value="">{translateText("Tất cả lớp được phân công")}</option>
          {(classes || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {setMeal && (
          <select aria-label={translateText("Bữa ăn")} value={meal} onChange={e => setMeal(e.target.value)}>
            {Object.entries(mealLabels).map(([code, label]) => <option key={code} value={code}>{translateText(label)}</option>)}
          </select>
        )}
        {setSearch && (
          <input aria-label={translateText("Tìm học sinh giáo viên")} placeholder={translateText("Tên hoặc mã học sinh...")} value={search} onChange={e => setSearch(e.target.value)} />
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {onReload && <button type="button" className="kp-button" onClick={onReload}>{translateText("Làm mới")}</button>}
        {onExport && (
          <button type="button" className="kp-button flex items-center gap-1.5" onClick={onExport} title={translateText("Xuất dữ liệu ra Excel")}>
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>{translateText("Xuất Excel")}</span>
          </button>
        )}
      </div>
    </div>
  );
}

function Table({ heads, children }: any) {
  useLanguage();
  return (
    <div className="kp-table-wrap">
      <table className="kp-table">
        <thead>
          <tr>{heads.map((h: string) => <th key={h}>{translateText(h)}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Cell({ children }: any) {
  useLanguage();
  return <td>{children ?? translateText('Chưa ghi nhận')}</td>;
}

export { TeacherClassesPage } from './pages/TeacherClassesPage';
export { TeacherMealsPage } from './pages/TeacherMealsPage';
export { TeacherNotesPage } from './pages/TeacherNotesPage';

export function TeacherReadPage({ kind }: { kind: 'history' | 'roster' | 'report' | 'allergies' | 'alerts' }) {
  useLanguage();
  const classes = useClasses(),
    [classId, setClassId] = useState(''),
    [date, setDate] = useState(schoolDate),
    [endDate, setEndDate] = useState(schoolDate),
    [search, setSearch] = useState(''),
    [status, setStatus] = useState('');
  const path = { history: 'meal-history', roster: 'snack-roster', report: 'meal-report', allergies: 'children', alerts: 'alerts' }[kind];
  const resource = useSchoolResource<any>(
    () => get(path, { classId, date, startDate: date, endDate, search, status: kind === 'roster' ? status : undefined, consumptionLevel: kind === 'history' ? status : undefined, limit: 1000 }),
    [kind, classId, date, endDate, search, status]
  );
  const data = resource.error ? null : resource.data;
  const title = { history: 'Lịch sử điểm danh & ăn uống', roster: 'Danh sách học sinh ăn xế', report: 'Báo cáo vận hành bữa ăn', allergies: 'Chế độ ăn & thông tin dị ứng', alerts: 'Tổng hợp cảnh báo trẻ' }[kind];
  const list = kind === 'allergies' ? (data?.items || []) : kind === 'report' ? (data?.rows || []) : Array.isArray(data) ? data : [];

  const handleExportExcel = async () => {
    if (!list.length) return alert(translateText("Chưa có dữ liệu để xuất Excel."));
    let headers: string[] = [];
    let rowsData: any[][] = [];
    let filename = '';

    if (kind === 'history') {
      filename = `Lich_su_an_uong_${date}_den_${endDate}.xlsx`;
      headers = ["Ngày", "Họ và tên", "Lớp", "Bữa ăn", "Điểm danh", "Mức ăn", "Ghi chú"];
      rowsData = list.map((r: any) => [
        r.date || '',
        r.fullName || '',
        r.className || '',
        mealLabels[r.mealType] || r.mealType || '',
        r.isAttended ? 'Có mặt' : 'Vắng',
        r.consumptionLevel ? stateLabels[r.consumptionLevel] || r.consumptionLevel : 'Chưa ghi nhận',
        r.note || '',
      ]);
    } else if (kind === 'roster') {
      filename = `Danh_sach_an_xe_${date}.xlsx`;
      headers = ["Họ và tên", "Mã học sinh", "Lớp", "Dịch vụ", "Trạng thái"];
      rowsData = list.map((r: any) => [
        r.fullName || '',
        r.studentCode || '',
        r.className || '',
        r.periodName || '',
        r.status || '',
      ]);
    } else if (kind === 'allergies') {
      filename = `Hoc_sinh_di_ung_${date}.xlsx`;
      headers = ["Học sinh", "Lớp", "Dị nguyên / chế độ ăn", "Mức độ", "Ghi chú"];
      rowsData = list.map((s: any) => [
        s.fullName || '',
        s.className || s.class?.name || '',
        (s.allergies || []).map((a: any) => a.allergenName || a.customAllergenName || a.allergen?.name).join(', ') || 'Chưa có khai báo dị ứng',
        (s.allergies || []).map((a: any) => a.severity).filter(Boolean).join(', ') || '—',
        (s.allergies || []).map((a: any) => a.dietaryNote || a.note || a.specialDietNote).filter(Boolean).join('; ') || '',
      ]);
    } else {
      filename = `Bao_cao_bua_an_${date}.xlsx`;
      headers = ["Bữa đã ghi nhận", "Có mặt", "Vắng"];
      rowsData = [[data?.recorded ?? 0, data?.present ?? 0, data?.absent ?? 0]];
    }

    await downloadExcel(filename, [headers, ...rowsData], title[kind] || 'Báo cáo');
  };

  return (
    <SchoolPage
      title={translateText(title)}
      description={translateText("Tra cứu dữ liệu đã lưu của lớp được phân công. Không tự sinh hồ sơ hoặc kết quả khi chưa có dữ liệu.")}
    >
      <Feedback error={classes.error} />
      <TeacherStatsOverview classes={classes.data} />
      
      {/* Thanh bộ lọc hợp nhất duy nhất - không chia nhỏ thành nhiều ô tách biệt */}
      <div className="kp-filters flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {kind === 'history' && (
            <>
              <Field label={translateText("Từ ngày")}>
                <input aria-label={translateText("Từ ngày lịch sử")} type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)} />
              </Field>
              <Field label={translateText("Đến ngày")}>
                <input aria-label={translateText("Đến ngày lịch sử")} type="date" value={endDate} onChange={e => e.target.value && setEndDate(e.target.value)} />
              </Field>
            </>
          )}
          {(kind === 'roster' || kind === 'report') && (
            <Field label={translateText("Ngày")}>
              <input aria-label={translateText("Ngày giáo viên")} type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)} />
            </Field>
          )}
          <select aria-label={translateText("Lớp phụ trách")} value={classId} onChange={e => setClassId(e.target.value)}>
            <option value="">{translateText("Tất cả lớp được phân công")}</option>
            {(classes.data || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {kind === 'history' && (
            <select aria-label={translateText("Lọc mức ăn lịch sử")} value={status} onChange={e => setStatus(e.target.value)}>
              <option value="">{translateText("Tất cả mức ăn")}</option>
              {['FULL', 'MOST', 'HALF', 'LITTLE', 'NONE'].map(s => <option key={s} value={s}>{translateText(stateLabels[s])}</option>)}
            </select>
          )}
          {kind === 'roster' && (
            <select className="kp-input" aria-label={translateText("Trạng thái đăng ký ăn sáng")} value={status} onChange={e => setStatus(e.target.value)}>
              <option value="">{translateText("Tất cả trạng thái")}</option>
              <option value="PAID">{translateText("Đã thanh toán")}</option>
              <option value="PENDING">{translateText("Chờ thanh toán")}</option>
              <option value="CANCELLED">{translateText("Đã hủy")}</option>
            </select>
          )}
          <input aria-label={translateText("Tìm học sinh giáo viên")} placeholder={translateText("Tên hoặc mã học sinh...")} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" className="kp-button" onClick={() => void resource.reload()}>
            {translateText("Làm mới")}
          </button>
          {kind !== 'alerts' && (
            <button
              type="button"
              className="kp-button flex items-center gap-1.5"
              disabled={!list.length}
              onClick={() => void handleExportExcel()}
              title={translateText("Xuất dữ liệu ra file Excel")}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>{translateText("Xuất Excel")}</span>
            </button>
          )}
        </div>
      </div>

      <State resource={resource} empty={kind !== 'alerts' && !list.length} />
      {kind === 'report' && data && (
        <div className="kp-stats">
          {[[translateText('Bữa đã ghi nhận'), data.recorded], [translateText('Có mặt'), data.present], [translateText('Vắng'), data.absent], ...(data.consumption || []).map((s: any) => [stateLabels[s.status], s.count])].map(([label, v]) => (
            <div key={label} className="kp-stat"><span>{translateText(label)}</span><strong>{translateText(v)}</strong></div>
          ))}
        </div>
      )}
      {kind === 'allergies' ? (
        <Table heads={['Học sinh', 'Lớp', 'Dị nguyên / chế độ ăn', 'Mức độ', 'Hướng dẫn đã ghi nhận']}>
          {list.map((s: any) => (
            <tr key={s.id}>
              <Cell>{s.fullName}</Cell>
              <Cell>{s.className || s.class?.name}</Cell>
              <Cell>{(s.allergies || []).map((a: any) => a.allergenName || a.customAllergenName || a.allergen?.name).join(', ') || translateText('Chưa có khai báo dị ứng')}</Cell>
              <Cell>{translateText((s.allergies || []).map((a: any) => a.severity).filter(Boolean).join(', ') || '—')}</Cell>
              <Cell>{translateText((s.allergies || []).map((a: any) => a.dietaryNote || a.note || a.specialDietNote).filter(Boolean).join('; ') || 'Xem hồ sơ dinh dưỡng để biết chế độ ăn đã lưu.')}</Cell>
            </tr>
          ))}
        </Table>
      ) : kind === 'alerts' ? (
        <div className="grid grid-cols-2 gap-5">
          {[['allergies', translateText('Học sinh có khai báo dị ứng')], ['growth', translateText('Cảnh báo thể trạng đã ghi nhận')]].map(([key, label]) => (
            <section key={key} className="bg-white border rounded-xl p-5 space-y-3">
              <h2 className="font-bold">{translateText(label)}</h2>
              {!data?.[key]?.length && <p>{translateText("Chưa có cảnh báo từ hồ sơ đã ghi nhận.")}</p>}
              {(data?.[key] || []).map((r: any) => (
                <article className="border-t pt-3" key={r.id}>
                  <b>{r.fullName || r.child?.fullName}</b>
                  <p>{r.overallNutritionalStatus || (r.allergies || []).map((a: any) => a.allergenName).join(', ')}</p>
                </article>
              ))}
            </section>
          ))}
        </div>
      ) : (
        <Table heads={kind === 'roster' ? ['Học sinh', 'Mã học sinh', 'Lớp', 'Dịch vụ', 'Trạng thái'] : ['Ngày', 'Học sinh', 'Lớp', 'Bữa', 'Có mặt', 'Mức ăn', 'Ghi chú']}>
          {list.map((r: any) => (
            <tr key={r.id}>
              {kind === 'roster' ? (
                <>
                  <Cell>{r.fullName}</Cell>
                  <Cell>{r.studentCode}</Cell>
                  <Cell>{r.className}</Cell>
                  <Cell>{r.periodName}</Cell>
                  <Cell>{translateText(r.status)}</Cell>
                </>
              ) : (
                <>
                  <Cell>{translateText(r.date)}</Cell>
                  <Cell>{r.fullName}</Cell>
                  <Cell>{r.className}</Cell>
                  <Cell>{translateText(mealLabels[r.mealType] || r.mealType)}</Cell>
                  <Cell>{translateText(r.isAttended ? 'Có mặt' : 'Vắng')}</Cell>
                  <Cell>{translateText(r.consumptionLevel ? stateLabels[r.consumptionLevel] || r.consumptionLevel : 'Chưa ghi nhận')}</Cell>
                  <Cell>{r.note || '—'}</Cell>
                </>
              )}
            </tr>
          ))}
        </Table>
      )}
    </SchoolPage>
  );
}

export function TeacherPortionsPage() {
  useLanguage();
  const classes = useClasses(),
    [classId, setClassId] = useState(''),
    [date, setDate] = useState(schoolDate),
    [meal, setMeal] = useState('LUNCH'),
    [draft, setDraft] = useState<Record<string, string>>({});
  const resource = useSchoolResource<any[]>(() => get('portions', { classId, date }), [classId, date]),
    action = useSchoolAction();
  useEffect(() => setDraft({}), [classId, date, meal]);
  const rows = (classes.data || []).filter(c => !classId || String(c.id) === classId).map(c => ({
    ...c,
    portion: (resource.data || []).find(r => Number(r.classId) === Number(c.id) && r.mealType === meal),
  }));

  const handleExportExcel = async () => {
    if (!rows.length) return alert(translateText("Chưa có kế hoạch suất ăn để xuất Excel."));
    await downloadExcel(
      `Ke_hoach_suat_an_${date}_${mealLabels[meal] || meal}.xlsx`,
      [
        ["Lớp", "Ngày", "Bữa ăn", "Đã đăng ký", "Bếp thực tế", "Số suất dự kiến"],
        ...rows.map(c => [
          c.name,
          date,
          mealLabels[meal] || meal,
          c.portion?.plannedQuantity ?? 0,
          c.portion?.actualQuantity ?? 0,
          draft[c.id] ?? c.portion?.plannedQuantity ?? 0,
        ]),
      ],
      `Suất ăn ${date}`
    );
  };

  return (
    <SchoolPage
      title={translateText("Đăng ký & kế hoạch suất ăn")}
      description={translateText("Nhập số suất dự kiến theo lớp, ngày và bữa. Số bếp chuẩn bị thực tế do bếp ghi nhận riêng.")}
    >
      <Feedback error={action.error || classes.error} message={action.message} />
      <TeacherStatsOverview classes={classes.data} />
      <Filters classes={classes.data} onReload={resource.reload} onExport={rows.length ? handleExportExcel : undefined} {...{ classId, setClassId, date, setDate, meal, setMeal }} />
      <State resource={resource} />
      <Table heads={['Lớp', 'Đã đăng ký', 'Bếp thực tế', 'Số suất dự kiến', 'Lưu']}>
        {rows.map(c => (
          <tr key={c.id}>
            <Cell>{c.name}</Cell>
            <Cell>{translateText(c.portion?.plannedQuantity)}</Cell>
            <Cell>{translateText(c.portion?.actualQuantity)}</Cell>
            <Cell>
              <input
                aria-label={translateText(`Suất dự kiến ${c.name}`)}
                type="number"
                min="0"
                step="1"
                value={draft[c.id] ?? c.portion?.plannedQuantity ?? ''}
                onChange={e => setDraft({ ...draft, [c.id]: e.target.value })}
              />
            </Cell>
            <Cell>
              <button
                className="kp-button primary"
                disabled={action.busy}
                onClick={() => void action.run(async () => {
                  const value = draft[c.id] ?? String(c.portion?.plannedQuantity ?? '');
                  if (!value.trim() || !Number.isSafeInteger(Number(value)) || Number(value) < 0) throw Error('Nhập số suất nguyên không âm.');
                  await apiClient.put('/teacher/portions', { classId: Number(c.id), date, mealType: meal, plannedQuantity: Number(value) });
                  await resource.reload();
                }, 'Đã lưu kế hoạch suất ăn.')}
              >
                {translateText("Lưu suất ")}{c.name}
              </button>
            </Cell>
          </tr>
        ))}
      </Table>
    </SchoolPage>
  );
}



export function TeacherGrowthPage(){
  useLanguage();
  const STATUS_LABELS: Record<string, string> = {
    NORMAL: 'Bình thường',
    UNDERWEIGHT: 'Thiếu cân',
    STUNTED: 'Thấp còi',
    WASTED: 'Gầy còm',
    OVERWEIGHT: 'Thừa cân',
    OBESE: 'Béo phì'
  };

  const classes = useClasses(),
    children = useSchoolResource<any>(() => get('children', { limit: 1000 }), []),
    [classId, setClassId] = useState(''),
    [search, setSearch] = useState(''),
    [status, setStatus] = useState(''),
    [form, setForm] = useState<any>(null),
    [importRows, setImportRows] = useState<any[] | null>(null);

  const resource = useSchoolResource<any>(
    () => get('growth', { classId, search, nutritionalStatus: status }),
    [classId, search, status]
  );
  const action = useSchoolAction(),
    input = useRef<HTMLInputElement>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    await action.run(async () => {
      const { id, ...data } = form;
      const body = { ...data, heightCm: Number(data.heightCm), weightKg: Number(data.weightKg) };
      if (id) await apiClient.put('/teacher/growth/' + id, body);
      else await apiClient.post('/teacher/growth', body);
      setForm(null);
      await resource.reload();
    }, 'Đã lưu kết quả cân đo.');
  };

  const read = async (file?: File) => {
    if (!file) return;
    await action.run(async () => {
      const book = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true }),
        rows = XLSX.utils.sheet_to_json<any>(book.Sheets[book.SheetNames[0]], { raw: false });
      if (!rows.length || rows.length > 1000) throw Error('Tệp cần từ 1 đến 1000 dòng.');
      for (const r of rows) {
        if (!(r.studentCode || r.studentId || r.childId) || !(r.measurementDate || r.measuredDate) || !Number.isFinite(Number(r.heightCm)) || Number(r.heightCm) <= 0 || !Number.isFinite(Number(r.weightKg)) || Number(r.weightKg) <= 0) {
          throw Error('Mỗi dòng cần mã học sinh, ngày đo, chiều cao và cân nặng dương.');
        }
      }
      setImportRows(rows.map(r => ({ ...r, heightCm: Number(r.heightCm), weightKg: Number(r.weightKg) })));
    });
  };

  const downloadTemplate = () => {
    const wsData = [
      ['studentCode', 'measurementDate', 'weightKg', 'heightCm', 'healthNotes'],
      ['HD-2023-01', '2026-11-16', 15.5, 98.2, 'Bình thường']
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'MauCanDo');
    XLSX.writeFile(wb, 'mau_nhap_lieu_can_do.xlsx');
  };

  const rawRows = resource.error ? [] : (resource.data?.items || []);
  const filteredRows = rawRows.filter((r: any) => {
    if (!search) return true;
    const q = search.toLowerCase().trim();
    const name = (r.child?.fullName || '').toLowerCase();
    const code = (r.child?.studentCode || '').toLowerCase();
    return name.includes(q) || code.includes(q);
  });

  const handleExportExcel = async () => {
    if (!filteredRows.length) return alert(translateText("Chưa có dữ liệu cân đo để xuất Excel."));
    await downloadExcel(
      `Ket_qua_can_do_${new Date().toISOString().slice(0, 10)}.xlsx`,
      [
        ["Mã học sinh", "Họ và tên", "Lớp", "Ngày đo", "Cân nặng (kg)", "Chiều cao (cm)", "Thể trạng", "Ghi chú sức khỏe"],
        ...filteredRows.map((r: any) => [
          r.child?.studentCode || '',
          r.child?.fullName || '',
          r.child?.class?.name || '',
          r.measurementDate || '',
          r.weightKg || '',
          r.heightCm || '',
          STATUS_LABELS[r.overallNutritionalStatus] || r.overallNutritionalStatus || 'Chưa đánh giá',
          r.healthNotes || '',
        ]),
      ],
      "Kết quả cân đo"
    );
  };

  return (
    <SchoolPage
      title={translateText("Chiều cao & cân nặng")}
      description={translateText("Nhập, sửa, import và tra cứu dữ liệu thể chất của học sinh trong lớp phụ trách.")}
    >
      <input type="file" className="hidden" ref={input} accept=".csv,.xlsx,.xls" onChange={e => { void read(e.target.files?.[0]); e.target.value = ''; }} />
      <Feedback error={action.error || classes.error || children.error} message={action.message} />
      <TeacherStatsOverview classes={classes.data} />
      <div className="kp-filters flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <select aria-label={translateText("Lớp phụ trách")} value={classId} onChange={e => setClassId(e.target.value)}>
            <option value="">{translateText("Tất cả lớp được phân công")}</option>
            {(classes.data || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input aria-label={translateText("Tìm học sinh giáo viên")} placeholder={translateText("Tên hoặc mã học sinh...")} value={search} onChange={e => setSearch(e.target.value)} />
          <select className="kp-input" aria-label={translateText("Lọc thể trạng")} value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">{translateText("Tất cả thể trạng")}</option>
            {Object.entries(STATUS_LABELS).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button className="kp-button" type="button" onClick={downloadTemplate}>
            📥 {translateText("Tải file mẫu")}
          </button>
          <button className="kp-button" onClick={() => input.current?.click()}>
            {translateText("Nhập Excel/CSV")}
          </button>
          <button
            type="button"
            className="kp-button flex items-center gap-1.5"
            disabled={!filteredRows.length}
            onClick={() => void handleExportExcel()}
            title={translateText("Xuất dữ liệu cân đo ra file Excel")}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>{translateText("Xuất Excel")}</span>
          </button>
          <button
            className="kp-button primary"
            onClick={() => setForm({ childId: '', measurementDate: schoolDate(), weightKg: '', heightCm: '', healthNotes: '' })}
          >
            {translateText("Nhập kết quả cân đo")}
          </button>
        </div>
      </div>
      <State resource={resource} empty={!filteredRows.length} />
      <Table heads={['Học sinh', 'Lớp', 'Ngày đo', 'Cân nặng (kg)', 'Chiều cao (cm)', 'Thể trạng', 'Sửa']}>
        {filteredRows.map((r: any) => (
          <tr key={r.id}>
            <Cell>{r.child?.fullName}</Cell>
            <Cell>{r.child?.class?.name}</Cell>
            <Cell>{translateText(r.measurementDate)}</Cell>
            <Cell>{translateText(r.weightKg)}</Cell>
            <Cell>{translateText(r.heightCm)}</Cell>
            <Cell>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                r.overallNutritionalStatus === 'NORMAL' ? 'bg-emerald-100 text-emerald-800' :
                r.overallNutritionalStatus === 'OVERWEIGHT' || r.overallNutritionalStatus === 'OBESE' ? 'bg-amber-100 text-amber-800' :
                'bg-rose-100 text-rose-800'
              }`}>
                {STATUS_LABELS[r.overallNutritionalStatus] || r.overallNutritionalStatus || 'Chưa đánh giá'}
              </span>
            </Cell>
            <Cell>
              <button
                className="kp-button"
                onClick={() => setForm({ id: r.id, childId: String(r.childId), measurementDate: r.measurementDate, weightKg: r.weightKg, heightCm: r.heightCm, healthNotes: r.healthNotes || '' })}
              >
                {translateText("Sửa cân đo")}
              </button>
            </Cell>
          </tr>
        ))}
      </Table>
      {form && (
        <Modal title={translateText(form.id ? 'Sửa kết quả cân đo' : 'Nhập kết quả cân đo')} onClose={() => !action.busy && setForm(null)}>
          <form onSubmit={save} className="space-y-4">
            <Field label={translateText("Học sinh")}>
              <select aria-label={translateText("Học sinh cân đo")} required disabled={!!form.id} value={form.childId} onChange={e => setForm({ ...form, childId: e.target.value })}>
                <option value="">{translateText("Chọn học sinh")}</option>
                {(children.data?.items || []).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.fullName} · {c.studentCode}</option>
                ))}
              </select>
            </Field>
            {[['measurementDate', 'Ngày đo', 'date'], ['weightKg', 'Cân nặng (kg)', 'number'], ['heightCm', 'Chiều cao (cm)', 'number']].map(([key, label, type]) => (
              <Field key={key} label={translateText(label)}>
                <input aria-label={translateText(label)} required type={type} step={type === 'number' ? 'any' : undefined} min={type === 'number' ? '0.01' : undefined} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} />
              </Field>
            ))}
            <Field label={translateText("Ghi chú sức khỏe")}>
              <textarea value={form.healthNotes} onChange={e => setForm({ ...form, healthNotes: e.target.value })} />
            </Field>
            <Feedback error={action.error} />
            <button className="kp-button primary" disabled={action.busy}>{translateText("Lưu cân đo")}</button>
          </form>
        </Modal>
      )}
      {importRows && (
        <Modal title={translateText(`Xem trước ${importRows.length} dòng cân đo`)} onClose={() => !action.busy && setImportRows(null)}>
          <pre className="text-xs overflow-auto max-h-80">{translateText(JSON.stringify(importRows, null, 2))}</pre>
          <Feedback error={action.error} />
          <button
            className="kp-button primary"
            disabled={action.busy}
            onClick={() => void action.run(async () => {
              const r = (await apiClient.post('/teacher/growth/import', { items: importRows })).data;
              if (r.success === false || r.errors?.length) throw Error(`Đã nhập ${r.importedCount || 0} dòng. ${(r.errors || []).join(' ')}`);
              setImportRows(null);
              await resource.reload();
            }, 'Đã nhập dữ liệu cân đo.')}
          >
            {translateText("Xác nhận import cân đo")}
          </button>
        </Modal>
      )}
    </SchoolPage>
  );
}
