import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { TrendingUp, Edit3 } from 'lucide-react';
import { GrowthRecordItem } from '../api/growth.api';
import { generateWhoGrowthCurveData, ChartCurvePoint } from '../utils/who-lms.util';

export interface WhoGrowthChartProps {
  child?: {
    id?: string;
    fullName?: string;
    studentCode?: string;
    gender?: 'MALE' | 'FEMALE';
    dateOfBirth?: string;
    class?: { id?: string; name?: string } | null;
  } | null;
  history?: GrowthRecordItem[];
  defaultMetric?: 'BMI' | 'WEIGHT' | 'HEIGHT';
  onEditRecord?: (record: GrowthRecordItem) => void;
  className?: string;
}

export const WhoGrowthChart: React.FC<WhoGrowthChartProps> = ({
  child,
  history = [],
  defaultMetric = 'BMI',
  onEditRecord,
  className = '',
}) => {
  const [metric, setMetric] = useState<'BMI' | 'WEIGHT' | 'HEIGHT'>(defaultMetric);

  const gender = (child?.gender?.toUpperCase() === 'FEMALE' ? 'FEMALE' : 'MALE') as 'MALE' | 'FEMALE';
  const chartData = useMemo(() => generateWhoGrowthCurveData(gender, history), [gender, history]);

  const latestRecord = history.length > 0 ? history[history.length - 1] : null;

  // Max measured values for dynamic Y-axis bounds
  const maxWeight = Math.max(0, ...history.map((h) => Number(h.weightKg) || 0));
  const maxHeight = Math.max(0, ...history.map((h) => Number(h.heightCm) || 0));
  const maxBmi = Math.max(0, ...history.map((h) => Number(h.bmi) || 0));

  const CustomGrowthTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const currentData = chartData.find((d) => d.month === label);
    const ageMonth = currentData?.ageMonth || parseInt(String(label).replace(/[^\d]/g, ''), 10);
    const recordAtMonth = history.find((h) => h.ageInMonths === ageMonth);

    const unit = metric === 'BMI' ? ' kg/m²' : metric === 'WEIGHT' ? ' kg' : ' cm';
    const metricTitle = metric === 'BMI' ? 'Chỉ số BMI' : metric === 'WEIGHT' ? 'Cân nặng' : 'Chiều cao';

    let actualVal: number | null = null;
    if (recordAtMonth) {
      actualVal =
        metric === 'BMI'
          ? Number(recordAtMonth.bmi)
          : metric === 'WEIGHT'
          ? Number(recordAtMonth.weightKg)
          : Number(recordAtMonth.heightCm);
    }

    let latestVal: number | null = null;
    if (latestRecord) {
      latestVal =
        metric === 'BMI'
          ? Number(latestRecord.bmi)
          : metric === 'WEIGHT'
          ? Number(latestRecord.weightKg)
          : Number(latestRecord.heightCm);
    }

    const medianVal =
      metric === 'BMI'
        ? currentData?.medianBmi
        : metric === 'WEIGHT'
        ? currentData?.medianWeight
        : currentData?.medianHeight;

    const diffFromMedian =
      actualVal != null && medianVal != null ? (actualVal - medianVal).toFixed(1) : null;

    return (
      <div className="bg-white/95 backdrop-blur-md p-3.5 rounded-2xl shadow-xl border border-slate-200 text-xs min-w-[270px] max-w-xs space-y-2.5">
        <div className="border-b border-slate-100 pb-1.5 flex items-center justify-between">
          <span className="font-extrabold text-slate-900 text-sm">📅 Mốc: {label}</span>
          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
            Chuẩn WHO 2006 (LMS)
          </span>
        </div>

        {/* Child actual data line */}
        <div className="bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-200/90 rounded-xl p-2.5 shadow-2xs">
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 font-bold text-teal-950 truncate">
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse shrink-0" />
              <span className="truncate">Bé: {child?.fullName || 'Học sinh'}</span>
            </div>
            {recordAtMonth && (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                  recordAtMonth.overallNutritionalStatus?.includes('OBESE') ||
                  recordAtMonth.bmiClassification === 'OBESE' ||
                  recordAtMonth.overallNutritionalStatus?.toLowerCase().includes('béo phì')
                    ? 'bg-rose-100 text-rose-700 border border-rose-200'
                    : recordAtMonth.overallNutritionalStatus?.includes('OVERWEIGHT') ||
                      recordAtMonth.overallNutritionalStatus?.toLowerCase().includes('thừa cân')
                    ? 'bg-amber-100 text-amber-700 border border-amber-200'
                    : recordAtMonth.overallNutritionalStatus?.includes('STUNTED') ||
                      recordAtMonth.overallNutritionalStatus?.toLowerCase().includes('thấp còi')
                    ? 'bg-orange-100 text-orange-700 border border-orange-200'
                    : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                }`}
              >
                {recordAtMonth.overallNutritionalStatus?.toLowerCase().includes('béo phì') ||
                recordAtMonth.bmiClassification === 'OBESE'
                  ? 'Béo phì'
                  : recordAtMonth.overallNutritionalStatus?.toLowerCase().includes('thừa cân')
                  ? 'Thừa cân'
                  : recordAtMonth.overallNutritionalStatus?.toLowerCase().includes('thấp còi')
                  ? 'Thấp còi'
                  : 'Bình thường'}
              </span>
            )}
          </div>

          {recordAtMonth ? (
            <div className="mt-1.5 flex items-baseline justify-between">
              <div>
                <span className="text-[11px] text-teal-700 font-semibold">{metricTitle}: </span>
                <span className="text-base font-black text-teal-950">
                  {actualVal}
                  {unit}
                </span>
              </div>
              {diffFromMedian && (
                <span
                  className={`text-[10px] font-bold ${
                    Number(diffFromMedian) > 0 ? 'text-amber-700' : 'text-slate-600'
                  }`}
                >
                  {Number(diffFromMedian) > 0 ? `+${diffFromMedian}` : diffFromMedian}
                  {unit} vs Median
                </span>
              )}
            </div>
          ) : (
            <div className="mt-1 space-y-0.5 text-slate-500">
              <div className="text-[11px] font-semibold text-amber-700 flex items-center gap-1">
                <span>⚠️ Chưa ghi nhận lần đo tại mốc {label}</span>
              </div>
              {latestRecord && (
                <div className="text-[10px] text-slate-600">
                  Lần đo gần nhất:{' '}
                  <strong className="text-teal-900 font-bold">
                    {latestVal}
                    {unit}
                  </strong>{' '}
                  (lúc {latestRecord.ageInMonths} thg • {new Date(latestRecord.measurementDate).toLocaleDateString('vi-VN')})
                </div>
              )}
            </div>
          )}
        </div>

        {/* WHO Reference Thresholds */}
        <div className="space-y-1.5 pt-0.5 text-[11px]">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Các ngưỡng quy chuẩn WHO:
          </div>
          {payload.map((entry: any, index: number) => {
            if (entry.dataKey.startsWith('actual')) return null;
            return (
              <div key={`item-${index}`} className="flex items-center justify-between text-slate-600">
                <div className="flex items-center gap-1.5 truncate">
                  <span
                    className="w-2.5 h-1 rounded-full shrink-0"
                    style={{ backgroundColor: entry.stroke || entry.color }}
                  />
                  <span className="truncate">{entry.name}:</span>
                </div>
                <span className="font-bold text-slate-800 ml-2 shrink-0">
                  {entry.value}
                  {unit}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={`bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-4 ${className}`}>
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-teal-600" />
            Biểu Đồ Đường Cong Tăng Trưởng WHO (UC-78)
          </h3>
          <p className="text-xs text-slate-500">
            {child ? (
              <span>
                Học sinh: <strong className="text-slate-800">{child.fullName}</strong> ({gender === 'FEMALE' ? 'Bé gái 👧' : 'Bé trai 👦'} • {child.studentCode} • {child.class?.name || 'Mầm non'})
              </span>
            ) : (
              'Chọn học sinh trong danh sách để xem biểu đồ chi tiết'
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* 3 Metric Modes Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => setMetric('BMI')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                metric === 'BMI'
                  ? 'bg-white text-rose-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📊 Chỉ Số BMI (kg/m²)
            </button>
            <button
              type="button"
              onClick={() => setMetric('WEIGHT')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                metric === 'WEIGHT'
                  ? 'bg-white text-teal-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ⚖️ Cân Nặng (kg)
            </button>
            <button
              type="button"
              onClick={() => setMetric('HEIGHT')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                metric === 'HEIGHT'
                  ? 'bg-white text-sky-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📏 Chiều Cao (cm)
            </button>
          </div>

          {latestRecord && (
            <div className="flex items-center gap-2">
              <div className="text-xs font-bold bg-teal-50 text-teal-800 px-3 py-1.5 rounded-2xl border border-teal-200">
                Lần đo gần nhất: {latestRecord.weightKg} kg • {latestRecord.heightCm} cm • BMI: {latestRecord.bmi}
              </div>
              {onEditRecord && (
                <button
                  type="button"
                  onClick={() => onEditRecord(latestRecord)}
                  className="px-3 py-1.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5"
                  title="Sửa số liệu đo lần gần nhất (UC-74)"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Sửa số liệu đo</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Chart Canvas */}
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />

            {metric === 'BMI' && (
              <YAxis
                unit=" kg/m²"
                tick={{ fontSize: 12 }}
                domain={[11, Math.max(25, Math.ceil(maxBmi + 3))]}
              />
            )}
            {metric === 'WEIGHT' && (
              <YAxis
                unit=" kg"
                tick={{ fontSize: 12 }}
                domain={[8, Math.max(26, Math.ceil(maxWeight + 3))]}
              />
            )}
            {metric === 'HEIGHT' && (
              <YAxis
                unit=" cm"
                tick={{ fontSize: 12 }}
                domain={[75, Math.max(122, Math.ceil(maxHeight + 4))]}
              />
            )}

            <Tooltip content={<CustomGrowthTooltip />} />
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />

            {/* ReferenceLine horizontal positioning at latest measured point */}
            {latestRecord && (
              <ReferenceLine
                y={
                  metric === 'BMI'
                    ? Number(latestRecord.bmi)
                    : metric === 'WEIGHT'
                    ? Number(latestRecord.weightKg)
                    : Number(latestRecord.heightCm)
                }
                stroke={metric === 'BMI' ? '#e11d48' : metric === 'WEIGHT' ? '#0d9488' : '#0284c7'}
                strokeDasharray="4 4"
                strokeWidth={2}
                label={{
                  value: `👤 ${child?.fullName || 'Bé'}: ${
                    metric === 'BMI'
                      ? latestRecord.bmi + ' kg/m²'
                      : metric === 'WEIGHT'
                      ? latestRecord.weightKg + ' kg'
                      : latestRecord.heightCm + ' cm'
                  }`,
                  fill: metric === 'BMI' ? '#be123c' : metric === 'WEIGHT' ? '#0f766e' : '#0369a1',
                  fontSize: 11,
                  fontWeight: 'bold',
                  position: 'insideTopRight',
                }}
              />
            )}

            {metric === 'BMI' && (
              <>
                <Line type="monotone" dataKey="plus3SdBmi" name="+3 SD (Béo phì nặng)" stroke="#dc2626" strokeDasharray="4 4" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="plus2SdBmi" name="+2 SD (Nguy cơ thừa cân)" stroke="#f59e0b" strokeDasharray="4 4" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="medianBmi" name="Chuẩn Trung vị WHO (Median)" stroke="#10b981" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="minus2SdBmi" name="-2 SD (Nguy cơ gầy còm)" stroke="#ef4444" strokeDasharray="4 4" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="actualBmi" name="Chỉ số BMI thực tế của bé (kg/m²)" stroke="#e11d48" strokeWidth={3.5} dot={{ r: 6, fill: '#e11d48', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 8 }} connectNulls={true} />
              </>
            )}

            {metric === 'WEIGHT' && (
              <>
                <Line type="monotone" dataKey="plus3SdWeight" name="+3 SD (Thừa cân nặng)" stroke="#dc2626" strokeDasharray="4 4" dot={false} strokeWidth={1.5} />
                <Line type="monotone" dataKey="plus2SdWeight" name="+2 SD (Nguy cơ thừa cân)" stroke="#f59e0b" strokeDasharray="4 4" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="medianWeight" name="Chuẩn Trung vị WHO (Median)" stroke="#10b981" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="minus2SdWeight" name="-2 SD (Nguy cơ nhẹ cân)" stroke="#ef4444" strokeDasharray="4 4" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="actualWeight" name="Cân nặng thực tế của bé (kg)" stroke="#0d9488" strokeWidth={3.5} dot={{ r: 6, fill: '#0d9488', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 8 }} connectNulls={true} />
              </>
            )}

            {metric === 'HEIGHT' && (
              <>
                <Line type="monotone" dataKey="plus3SdHeight" name="+3 SD (Chiều cao rất vượt trội)" stroke="#dc2626" strokeDasharray="4 4" dot={false} strokeWidth={1.5} />
                <Line type="monotone" dataKey="plus2SdHeight" name="+2 SD (Chiều cao vượt trội)" stroke="#f59e0b" strokeDasharray="4 4" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="medianHeight" name="Chuẩn Chiều cao WHO (Median)" stroke="#10b981" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="minus2SdHeight" name="-2 SD (Nguy cơ thấp còi)" stroke="#ef4444" strokeDasharray="4 4" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="actualHeight" name="Chiều cao thực tế của bé (cm)" stroke="#0284c7" strokeWidth={3.5} dot={{ r: 6, fill: '#0284c7', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 8 }} connectNulls={true} />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
