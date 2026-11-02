import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  Calendar,
  HeartPulse,
  Scale,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  X,
  User,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Layers,
  Edit3,
  Trash2,
  UploadCloud,
  Download,
  Lock,
} from 'lucide-react';
import { WhoGrowthChart } from '../components/WhoGrowthChart';
import { growthApi, GrowthRecordItem, CreateGrowthDto } from '../api/growth.api';
import { apiClient } from '../../../core/api/axios';

export const ChildGrowthMonitoringPage: React.FC = () => {
  const [records, setRecords] = useState<GrowthRecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [childrenList, setChildrenList] = useState<Array<{ id: string; fullName: string; studentCode: string }>>([]);

  // Expanded classes state: Record<className, boolean>
  const [expandedClasses, setExpandedClasses] = useState<Record<string, boolean>>({});

  // Selected child for chart view
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [childHistory, setChildHistory] = useState<GrowthRecordItem[]>([]);
  const [selectedChildInfo, setSelectedChildInfo] = useState<any>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<CreateGrowthDto>({
    childId: '',
    measurementDate: new Date().toISOString().split('T')[0],
    weightKg: '' as any,
    heightCm: '' as any,
    healthNotes: '',
  });

  // Real-time BMI calculation according to WHO LMS formula: BMI = weightKg / ((heightCm / 100)^2)
  const previewBmi = useMemo(() => {
    const w = Number(formData.weightKg);
    const h = Number(formData.heightCm);
    if (w > 0 && h > 0) {
      const hM = h / 100;
      return Math.round((w / (hM * hM)) * 100) / 100;
    }
    return 0;
  }, [formData.weightKg, formData.heightCm]);

  const getBmiStatusInfo = (bmi: number) => {
    if (!bmi || bmi <= 0) {
      return {
        label: 'Chưa có dữ liệu',
        color: 'text-slate-500 bg-slate-100 border-slate-200',
        containerStyle: 'bg-slate-50/80 border-slate-200 text-slate-700',
        alertLevel: 'NONE',
        alertMessage: 'Vui lòng nhập chiều cao và cân nặng để hệ thống đánh giá thể lực.',
      };
    }
    if (bmi >= 25) {
      return {
        label: 'Béo phì (OBESE, BMI ≥ 25)',
        color: 'text-rose-800 bg-rose-100 border-rose-300 font-black',
        containerStyle: 'bg-rose-50/95 border-rose-300 text-rose-950 shadow-rose-100/50',
        alertLevel: 'RED',
        alertMessage: '🚨 Cảnh báo đỏ: Trẻ béo phì - Cần giảm chất béo/đường ngọt, tăng cường vận động.',
      };
    }
    if (bmi >= 19) {
      return {
        label: 'Thừa cân (OVERWEIGHT, BMI ≥ 19)',
        color: 'text-amber-800 bg-amber-100 border-amber-300 font-bold',
        containerStyle: 'bg-amber-50/95 border-amber-300 text-amber-950 shadow-amber-100/50',
        alertLevel: 'AMBER',
        alertMessage: '⚠️ Cảnh báo vàng cam: Trẻ thừa cân - Cần điều chỉnh khẩu phần và tăng cường vận động.',
      };
    }
    if (bmi < 13.5) {
      return {
        label: 'Nhẹ cân / Gầy còm (UNDERWEIGHT)',
        color: 'text-orange-800 bg-orange-100 border-orange-300 font-bold',
        containerStyle: 'bg-orange-50/95 border-orange-300 text-orange-950 shadow-orange-100/50',
        alertLevel: 'ORANGE',
        alertMessage: '⚠️ Cảnh báo cam: Trẻ nhẹ cân / gầy còm - Cần bổ sung vi chất và khẩu phần dinh dưỡng.',
      };
    }
    return {
      label: 'Bình thường (NORMAL)',
      color: 'text-emerald-800 bg-emerald-100 border-emerald-300 font-bold',
      containerStyle: 'bg-emerald-50/90 border-emerald-200 text-emerald-950 shadow-emerald-100/30',
      alertLevel: 'GREEN',
      alertMessage: '✨ Đạt chuẩn thể lực WHO: Trẻ phát triển cân đối và khỏe mạnh.',
    };
  };

  // Edit record state (UC-74)
  const [editingRecord, setEditingRecord] = useState<GrowthRecordItem | null>(null);
  const [editFormData, setEditFormData] = useState({
    measurementDate: '',
    weightKg: 0,
    heightCm: 0,
    healthNotes: '',
  });
  const [successNotification, setSuccessNotification] = useState<string | null>(null);

  // Real-time estimated new BMI for editing modal
  const previewEditBmi = useMemo(() => {
    const w = Number(editFormData.weightKg);
    const h = Number(editFormData.heightCm);
    if (w > 0 && h > 0) {
      const hM = h / 100;
      return Math.round((w / (hM * hM)) * 100) / 100;
    }
    return 0;
  }, [editFormData.weightKg, editFormData.heightCm]);

  // Import modal state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importResult, setImportResult] = useState<{ count: number; errors: string[] } | null>(null);

  const sampleGrowthCsv = `Mã học sinh, Ngày đo (YYYY-MM-DD), Cân nặng (kg), Chiều cao (cm), Ghi chú
HS-2026-0001, 2026-10-01, 15.2, 98.5, Khám sức khỏe định kỳ
HS-2026-0002, 2026-10-01, 14.8, 96.0, Thể lực bình thường
HS-2026-0003, 2026-10-01, 12.0, 92.0, Cần bổ sung dinh dưỡng`;

  const handleOpenEdit = (r: GrowthRecordItem) => {
    setEditingRecord(r);
    setEditFormData({
      measurementDate: r.measurementDate,
      weightKg: Number(r.weightKg),
      heightCm: Number(r.heightCm),
      healthNotes: r.healthNotes || '',
    });
  };

  const handleUpdateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;

    const w = Number(editFormData.weightKg);
    const h = Number(editFormData.heightCm);
    if (isNaN(w) || w < 3 || w > 60) {
      alert('Cân nặng phải trong khoảng từ 3.0 kg đến 60.0 kg.');
      return;
    }
    if (isNaN(h) || h < 40 || h > 150) {
      alert('Chiều cao phải trong khoảng từ 40.0 cm đến 150.0 cm.');
      return;
    }

    setSubmitting(true);
    try {
      await growthApi.updateRecord(editingRecord.id, editFormData);
      const targetChildId = editingRecord.childId || selectedChildId;
      setEditingRecord(null);

      // 1. Làm mới danh sách bản ghi và tính lại KPI toàn trường / lớp
      await fetchData();

      // 2. Vẽ lại đường cong tăng trưởng WHO của học sinh đang chọn
      if (targetChildId) {
        setSelectedChildId(targetChildId);
        const hist = await growthApi.getChildHistory(targetChildId);
        setChildHistory(hist.history || []);
        if (hist.child) {
          setSelectedChildInfo(hist.child);
        }
      }

      setSuccessNotification(
        'Cập nhật chỉ số thể chất thành công! Toàn bộ Z-score (WAZ, HAZ, BAZ) và biểu đồ WHO đã được tính toán lại theo số liệu mới.'
      );
      setTimeout(() => setSuccessNotification(null), 6000);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Có lỗi khi cập nhật số liệu.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRecord = async (id: string, childName: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa bản ghi cân đo của học sinh "${childName}"?`)) return;
    try {
      await growthApi.deleteRecord(id);
      alert('Đã xóa bản ghi thành công!');
      fetchData();
      if (selectedChildId) {
        growthApi.getChildHistory(selectedChildId).then((res) => {
          setChildHistory(res.history || []);
        });
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Có lỗi khi xóa bản ghi.');
    }
  };

  const handleImportSubmit = async () => {
    if (!importText.trim()) return;
    setImporting(true);
    setImportResult(null);
    try {
      const lines = importText.trim().split('\n');
      const items = [];
      const startIdx =
        lines[0].toLowerCase().includes('mã') ||
        lines[0].toLowerCase().includes('student') ||
        lines[0].toLowerCase().includes('ngày')
          ? 1
          : 0;

      for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const delimiter = line.includes('\t') ? '\t' : ',';
        const parts = line.split(delimiter).map((s) => s.trim());
        if (parts.length >= 4) {
          items.push({
            studentCode: parts[0],
            measurementDate: parts[1],
            weightKg: parseFloat(parts[2]),
            heightCm: parseFloat(parts[3]),
            healthNotes: parts[4] || undefined,
          });
        }
      }

      if (items.length === 0) {
        alert('Không tìm thấy dòng dữ liệu cân đo hợp lệ.');
        setImporting(false);
        return;
      }

      const res = await growthApi.importRecords(items);
      setImportResult({ count: res.importedCount, errors: res.errors || [] });
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi nhập dữ liệu.');
    } finally {
      setImporting(false);
    }
  };

  const handleExportReport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const res = await growthApi.exportReport(selectedClass !== 'ALL' ? selectedClass : undefined);
      if (!res.items || res.items.length === 0) {
        alert('Không có dữ liệu để xuất báo cáo.');
        return;
      }

      // Convert items to CSV with 14 standard columns according to UC-80
      const headers = [
        'Mã học sinh',
        'Họ và tên',
        'Giới tính',
        'Lớp',
        'Ngày đo',
        'Tuổi (tháng)',
        'Cân nặng (kg)',
        'Chiều cao (cm)',
        'WAZ',
        'HAZ',
        'BAZ',
        'Thể lực',
        'Tình trạng',
        'Ghi chú',
      ];

      const escapeField = (val: any) => {
        if (val === null || val === undefined) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const escapeNotes = (notes: any) => {
        const str = notes == null ? '' : String(notes);
        return `"${str.replace(/"/g, '""')}"`;
      };

      const rows = res.items.map((it: any) => {
        const studentCode = it.studentCode ?? it.child?.studentCode ?? '';
        const childName = it.childName ?? it.child?.fullName ?? '';
        let gender = it.gender ?? it.child?.gender ?? '';
        if (gender === 'MALE' || gender === 'male') gender = 'Nam';
        else if (gender === 'FEMALE' || gender === 'female') gender = 'Nữ';
        const className = it.className ?? it.child?.class?.name ?? '';
        const measurementDate = it.measurementDate ? String(it.measurementDate).split('T')[0] : '';
        const ageInMonths = it.ageInMonths ?? '';
        const weightKg = it.weightKg ?? '';
        const heightCm = it.heightCm ?? '';
        const waz = it.waz != null ? Number(it.waz).toFixed(2) : '';
        const haz = it.haz != null ? Number(it.haz).toFixed(2) : '';
        const baz = it.baz != null ? Number(it.baz).toFixed(2) : '';
        const weightStatus = it.weightStatus ?? it.weightClassification ?? '';
        const overallStatus = it.overallStatus ?? it.overallNutritionalStatus ?? '';
        const notes = it.notes ?? it.healthNotes ?? '';

        return [
          escapeField(studentCode),
          escapeField(childName),
          escapeField(gender),
          escapeField(className),
          escapeField(measurementDate),
          ageInMonths,
          weightKg,
          heightCm,
          waz,
          haz,
          baz,
          escapeField(weightStatus),
          escapeField(overallStatus),
          escapeNotes(notes),
        ];
      });

      // Gắn tiền tố \uFEFF (Byte Order Mark) vào đầu file để Microsoft Excel nhận diện đúng bảng mã Tiếng Việt UTF-8
      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const today = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `Bao_Cao_Phat_Trien_The_Luc_${today}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setSuccessNotification(`Xuất báo cáo phát triển thể chất thành công! Tệp Bao_Cao_Phat_Trien_The_Luc_${today}.csv đã được tải xuống (${res.items.length} bản ghi).`);
    } catch (err: any) {
      alert('Không thể xuất báo cáo: ' + (err.response?.data?.message || err.message));
    } finally {
      setExporting(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [recRes, classRes, childRes] = await Promise.all([
        growthApi.getRecords({ limit: 500 }),
        apiClient.get('/classes').catch(() => ({ data: [] })),
        apiClient.get('/children?limit=200').catch(() => ({ data: [] })),
      ]);

      setRecords(recRes.items || []);
      const classItems = Array.isArray(classRes.data)
        ? classRes.data
        : ((classRes.data as any)?.items || (classRes.data as any)?.data || []);
      setClasses(classItems);
      const childItems = Array.isArray(childRes.data)
        ? childRes.data
        : ((childRes.data as any)?.items || (childRes.data as any)?.data || []);
      setChildrenList(childItems);

      if (recRes.items && recRes.items.length > 0 && !selectedChildId) {
        setSelectedChildId(recRes.items[0].childId);
      }
    } catch (err) {
      console.error('Error fetching growth records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedChildId) {
      growthApi.getChildHistory(selectedChildId).then((res) => {
        setChildHistory(res.history || []);
        setSelectedChildInfo(res.child);
      }).catch(console.error);
    }
  }, [selectedChildId]);

  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.childId) {
      alert('Vui lòng chọn học sinh.');
      return;
    }
    const weight = Number(formData.weightKg);
    const height = Number(formData.heightCm);

    if (isNaN(weight) || weight < 3 || weight > 60) {
      alert('Cân nặng phải trong giới hạn từ 3.0 kg đến 60.0 kg.');
      return;
    }
    if (isNaN(height) || height < 40 || height > 150) {
      alert('Chiều cao phải trong giới hạn từ 40.0 cm đến 150.0 cm.');
      return;
    }

    setSubmitting(true);
    try {
      await growthApi.createRecord(formData);
      setIsModalOpen(false);
      setFormData({
        childId: '',
        measurementDate: new Date().toISOString().split('T')[0],
        weightKg: '' as any,
        heightCm: '' as any,
        healthNotes: '',
      });
      fetchData();
      if (formData.childId === selectedChildId) {
        const hist = await growthApi.getChildHistory(formData.childId);
        setChildHistory(hist.history || []);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Có lỗi xảy ra khi lưu chỉ số thể lực.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRecords = records.filter((r) => {
    const matchesSearch =
      r.child?.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      r.child?.studentCode?.toLowerCase().includes(search.toLowerCase());
    const childClass =
      r.child?.class?.name ||
      (r as any).childClassName ||
      classes.find((cls) => String(cls.id) === String((r.child as any)?.classId || r.child?.class?.id))?.name ||
      '';
    const matchesClass =
      selectedClass === 'ALL' ||
      r.child?.class?.id === selectedClass ||
      (r.child as any)?.classId === selectedClass ||
      childClass.includes(selectedClass);
    return matchesSearch && matchesClass;
  });

  const groupedRecords = useMemo(() => {
    const groups: Record<string, { className: string; classId?: string; items: GrowthRecordItem[] }> = {};

    filteredRecords.forEach((r) => {
      const clsName =
        r.child?.class?.name ||
        (r as any).childClassName ||
        (r as any).className ||
        classes.find((cls) => String(cls.id) === String((r.child as any)?.classId || r.child?.class?.id))?.name ||
        (r.child?.studentCode?.includes('2021-05') || r.child?.studentCode?.includes('2021-04') || r.child?.studentCode?.includes('2021-03')
          ? 'Lớp Lá 2 (5-6 tuổi)'
          : r.child?.studentCode?.includes('2021-01') || r.child?.studentCode?.includes('2021-02')
          ? 'Lớp Lá 1 (5-6 tuổi)'
          : r.child?.studentCode?.includes('2022-04') || r.child?.studentCode?.includes('2022-05')
          ? 'Lớp Chồi 2 (4-5 tuổi)'
          : r.child?.studentCode?.includes('2022-01') || r.child?.studentCode?.includes('2022-02')
          ? 'Lớp Chồi 1 (4-5 tuổi)'
          : r.child?.studentCode?.includes('2023-01') || r.child?.studentCode?.includes('2023-02') || r.child?.studentCode?.includes('2023-03')
          ? 'Lớp Mầm 1 (3-4 tuổi)'
          : 'Lớp Mầm 2 (3-4 tuổi)');

      if (!groups[clsName]) {
        groups[clsName] = {
          className: clsName,
          classId: (r.child as any)?.classId || r.child?.class?.id,
          items: [],
        };
      }
      groups[clsName].items.push(r);
    });

    return Object.values(groups).sort((a, b) => a.className.localeCompare(b.className, 'vi'));
  }, [filteredRecords, classes]);

  useEffect(() => {
    const initial: Record<string, boolean> = {};
    groupedRecords.forEach((g) => {
      initial[g.className] = expandedClasses[g.className] !== undefined ? expandedClasses[g.className] : true;
    });
    setExpandedClasses(initial);
  }, [groupedRecords.length]);

  const toggleClassExpand = (className: string) => {
    setExpandedClasses((prev) => ({
      ...prev,
      [className]: prev[className] !== undefined ? !prev[className] : false,
    }));
  };

  const expandAllClasses = () => {
    const next: Record<string, boolean> = {};
    groupedRecords.forEach((g) => {
      next[g.className] = true;
    });
    setExpandedClasses(next);
  };

  const collapseAllClasses = () => {
    const next: Record<string, boolean> = {};
    groupedRecords.forEach((g) => {
      next[g.className] = false;
    });
    setExpandedClasses(next);
  };

  // Calculate summary stats for whole school or selected class (UC-74)
  const summaryRecords = useMemo(() => {
    if (selectedClass === 'ALL') return records;
    return records.filter((r) => {
      const clsId = (r.child as any)?.classId || r.child?.class?.id;
      const clsName = r.child?.class?.name;
      return String(clsId) === String(selectedClass) || clsName === selectedClass;
    });
  }, [records, selectedClass]);

  const selectedClassName = useMemo(() => {
    if (selectedClass === 'ALL') return 'Toàn trường';
    const c = classes.find((item) => String(item.id) === String(selectedClass));
    return c ? c.name : 'Lớp đã chọn';
  }, [selectedClass, classes]);

  const totalEvaluated = summaryRecords.length;
  const normalCount = summaryRecords.filter(
    (r) =>
      r.overallNutritionalStatus === 'NORMAL' ||
      r.overallNutritionalStatus === 'BINH_THUONG' ||
      r.overallNutritionalStatus?.toLowerCase().includes('bình thường')
  ).length;
  const stuntedCount = summaryRecords.filter(
    (r) =>
      r.heightClassification?.includes('STUNTED') ||
      r.heightClassification?.toLowerCase().includes('thấp còi')
  ).length;
  const overweightCount = summaryRecords.filter(
    (r) =>
      r.bmiClassification?.includes('OVERWEIGHT') ||
      r.bmiClassification === 'OBESE' ||
      r.bmiClassification?.toLowerCase().includes('thừa cân') ||
      r.bmiClassification?.toLowerCase().includes('béo phì')
  ).length;

  const normalPercent = totalEvaluated > 0 ? Math.round((normalCount / totalEvaluated) * 100) : 0;
  const stuntedPercent = totalEvaluated > 0 ? Math.round((stuntedCount / totalEvaluated) * 100) : 0;
  const overweightPercent = totalEvaluated > 0 ? Math.round((overweightCount / totalEvaluated) * 100) : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* ─── 1. TOP HEADER BANNER ─── */}
      <div className="bg-gradient-to-r from-teal-950 via-emerald-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-teal-800/40">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-teal-500/20 border border-teal-400/30 text-teal-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              Chuẩn Nhân Trắc Học WHO 2006
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Theo Dõi Thể Lực & Tăng Trưởng Trẻ Mầm Non
            </h1>
            <p className="text-teal-100 text-xs sm:text-sm leading-relaxed">
              Tự động tính toán các chỉ số Z-Score theo phương pháp LMS: Cân nặng theo tuổi (WAZ), Chiều cao theo tuổi (HAZ) và BMI theo tuổi (BAZ).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={handleExportReport}
              disabled={exporting}
              className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              title="Xuất file CSV báo cáo thể lực học sinh (UC-80)"
            >
              <Download className={`w-4 h-4 ${exporting ? 'animate-bounce' : ''}`} />
              <span>{exporting ? 'Đang xuất...' : 'Xuất Báo Cáo'}</span>
            </button>
            <button
              onClick={() => {
                setImportText('');
                setImportResult(null);
                setIsImportModalOpen(true);
              }}
              className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 transition flex items-center gap-2"
              title="Nhập hàng loạt số liệu cân đo từ bảng tính"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Nhập Excel / CSV</span>
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-5 py-3 rounded-2xl bg-teal-400 hover:bg-teal-300 text-teal-950 font-bold text-xs shadow-lg transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Ghi Nhận Mới</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── SUCCESS TOAST NOTIFICATION (UC-74) ─── */}
      {successNotification && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-2xl flex items-center justify-between shadow-md animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2.5 text-xs font-bold">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successNotification}</span>
          </div>
          <button
            onClick={() => setSuccessNotification(null)}
            className="text-emerald-700 hover:text-emerald-950 p-1 rounded-lg hover:bg-emerald-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ─── 2. SUMMARY KPI STATS (TOÀN TRƯỜNG / THEO LỚP) ─── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
          <span>Thống kê dinh dưỡng: <strong className="text-teal-800">{selectedClassName}</strong></span>
          <span className="text-[11px] font-normal text-slate-400">Tự động tính toán lại khi cập nhật số liệu cân đo</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Đã Đánh Giá ({selectedClassName})</div>
            <div className="text-2xl font-black text-slate-900">{totalEvaluated} <span className="text-sm font-semibold text-slate-400">lượt</span></div>
            <div className="text-xs text-slate-400">Dữ liệu cân đo thể lực định kỳ</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
            <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Bình Thường</div>
            <div className="text-2xl font-black text-emerald-700">
              {normalPercent}%
            </div>
            <div className="text-xs text-emerald-600 font-semibold">{normalCount} học sinh đạt chuẩn WHO</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
            <div className="text-xs font-bold text-amber-600 uppercase tracking-wider">Thấp Còi (HAZ &lt; -2 SD)</div>
            <div className="text-2xl font-black text-amber-700">
              {stuntedPercent}%
            </div>
            <div className="text-xs text-amber-600 font-semibold">{stuntedCount} trẻ cần can thiệp vi chất</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
            <div className="text-xs font-bold text-rose-600 uppercase tracking-wider">Thừa Cân / Béo Phì</div>
            <div className="text-2xl font-black text-rose-700">
              {overweightPercent}%
            </div>
            <div className="text-xs text-rose-600 font-semibold">{overweightCount} trẻ cần giảm chất béo/ngọt</div>
          </div>
        </div>
      </div>

      {/* ─── 3. INTERACTIVE WHO GROWTH CHART SECTION (UC-78) ─── */}
      <WhoGrowthChart
        child={selectedChildInfo}
        history={childHistory}
        onEditRecord={handleOpenEdit}
      />

      {/* ─── 4. SEARCH & FILTER BAR ─── */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên học sinh, mã số..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Nút Sổ tất cả lớp / Thu gọn tất cả */}
          <div className="flex items-center gap-1.5 border border-slate-200 bg-white rounded-2xl p-1 shadow-xs">
            <button
              type="button"
              onClick={expandAllClasses}
              className="px-2.5 py-1 text-xs font-bold rounded-xl text-teal-700 hover:bg-teal-50 transition flex items-center gap-1"
              title="Sổ danh sách tất cả các lớp ra"
            >
              <ChevronDown className="w-3.5 h-3.5 text-teal-600" />
              <span>Sổ tất cả lớp</span>
            </button>
            <span className="text-slate-200">|</span>
            <button
              type="button"
              onClick={collapseAllClasses}
              className="px-2.5 py-1 text-xs font-bold rounded-xl text-slate-600 hover:bg-slate-100 transition flex items-center gap-1"
              title="Thu gọn danh sách tất cả các lớp"
            >
              <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
              <span>Thu gọn</span>
            </button>
          </div>

          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="px-3 py-2 text-xs rounded-2xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-semibold"
          >
            <option value="ALL">Tất cả các lớp</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ─── 5. MEASUREMENT RECORDS ACCORDION BY CLASS ─── */}
      <div className="space-y-4">
        {groupedRecords.length > 0 ? (
          groupedRecords.map((group) => {
            const isExpanded = expandedClasses[group.className] !== false;
            const stuntedInClass = group.items.filter(
              (r) =>
                Number(r.haz) < -2.0 ||
                r.heightClassification?.includes('STUNTED') ||
                r.heightClassification?.toLowerCase().includes('thấp còi')
            ).length;
            const overweightInClass = group.items.filter(
              (r) =>
                Number(r.baz) > 2.0 ||
                Number(r.bmi) >= 19 ||
                r.bmiClassification?.includes('OVERWEIGHT') ||
                r.bmiClassification === 'OBESE' ||
                r.bmiClassification?.toLowerCase().includes('thừa cân') ||
                r.bmiClassification?.toLowerCase().includes('béo phì')
            ).length;
            const underweightInClass = group.items.filter(
              (r) =>
                Number(r.waz) < -2.0 ||
                Number(r.baz) < -2.0 ||
                r.weightClassification?.includes('UNDERWEIGHT') ||
                r.bmiClassification === 'WASTED' ||
                r.bmiClassification === 'SEVERELY_WASTED'
            ).length;

            return (
              <div
                key={group.className}
                className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden transition-all duration-200"
              >
                {/* Accordion Class Header */}
                <div
                  onClick={() => toggleClassExpand(group.className)}
                  className="px-5 py-3.5 bg-gradient-to-r from-slate-50 via-teal-50/20 to-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-teal-50/40 transition select-none"
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleClassExpand(group.className);
                      }}
                      className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:text-teal-700 hover:border-teal-400 shadow-xs transition"
                      title={isExpanded ? 'Thu gọn lớp' : 'Sổ danh sách lớp ra'}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-teal-600" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-500" />
                      )}
                    </button>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="w-7 h-7 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center">
                        <GraduationCap className="w-4 h-4" />
                      </div>
                      <h3 className="font-extrabold text-slate-900 text-sm tracking-tight">{group.className}</h3>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-100 text-teal-800">
                        {group.items.length} học sinh
                      </span>
                      {stuntedInClass > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          {stuntedInClass} thấp còi
                        </span>
                      )}
                      {overweightInClass > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                          {overweightInClass} thừa cân/béo phì
                        </span>
                      )}
                      {underweightInClass > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-300">
                          {underweightInClass} nhẹ cân/gầy còm
                        </span>
                      )}
                      {stuntedInClass === 0 && overweightInClass === 0 && underweightInClass === 0 && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300">
                          100% chuẩn thể lực
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleClassExpand(group.className);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                        isExpanded
                          ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          : 'bg-teal-600 text-white shadow-sm hover:bg-teal-700'
                      }`}
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5" />
                          <span>Thu gọn</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5" />
                          <span>Sổ lớp ra</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Table for this class when expanded */}
                {isExpanded && (
                  <div className="overflow-x-auto animate-in fade-in duration-150">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-100 uppercase tracking-wider text-[11px]">
                        <tr>
                          <th className="py-3.5 px-4">Học Sinh</th>
                          <th className="py-3.5 px-3">Ngày Đo</th>
                          <th className="py-3.5 px-3">Tuổi (Tháng)</th>
                          <th className="py-3.5 px-3">Cân Nặng</th>
                          <th className="py-3.5 px-3">Chiều Cao</th>
                          <th className="py-3.5 px-3">BMI</th>
                          <th className="py-3.5 px-3">Z-Score (WAZ / HAZ / BAZ)</th>
                          <th className="py-3.5 px-3">Tình Trạng Thể Lực</th>
                          <th className="py-3.5 px-4 text-right">Xem Biểu Đồ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {group.items.map((r) => {
                          const wVal = Number(r.waz);
                          const hVal = Number(r.haz);
                          const bVal = Number(r.baz);
                          const bmiVal = Number(r.bmi);

                          const wClass =
                            wVal < -3.0
                              ? 'bg-rose-100 text-rose-800 border-rose-300 font-bold'
                              : wVal < -2.0
                              ? 'bg-orange-100 text-orange-800 border-orange-300 font-bold'
                              : wVal > 3.0
                              ? 'bg-rose-100 text-rose-800 border-rose-300 font-bold'
                              : wVal > 2.0
                              ? 'bg-amber-100 text-amber-800 border-amber-300 font-bold'
                              : 'bg-slate-100 text-slate-700 border-slate-200';

                          const hClass =
                            hVal < -3.0
                              ? 'bg-rose-100 text-rose-800 border-rose-300 font-bold'
                              : hVal < -2.0
                              ? 'bg-amber-100 text-amber-800 border-amber-300 font-bold'
                              : 'bg-slate-100 text-slate-700 border-slate-200';

                          const bClass =
                            bVal > 3.0 || bmiVal >= 25
                              ? 'bg-rose-100 text-rose-800 border-rose-300 font-bold'
                              : bVal > 2.0 || bmiVal >= 19
                              ? 'bg-amber-100 text-amber-800 border-amber-300 font-bold'
                              : bVal < -3.0
                              ? 'bg-rose-100 text-rose-800 border-rose-300 font-bold'
                              : bVal < -2.0
                              ? 'bg-orange-100 text-orange-800 border-orange-300 font-bold'
                              : 'bg-slate-100 text-slate-700 border-slate-200';

                          const st = (r.overallNutritionalStatus || '').toUpperCase();
                          let statusLabel = 'Bình thường';
                          let statusColor = 'bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold';

                          if (st === 'OBESE' || st.includes('BÉO PHÌ') || r.bmiClassification === 'OBESE') {
                            statusLabel = 'Béo phì';
                            statusColor = 'bg-rose-100 text-rose-800 border border-rose-300 font-black';
                          } else if (st === 'OVERWEIGHT' || st.includes('THỪA CÂN') || r.bmiClassification === 'OVERWEIGHT') {
                            statusLabel = 'Thừa cân';
                            statusColor = 'bg-amber-100 text-amber-800 border border-amber-300 font-bold';
                          } else if (st === 'SEVERELY_STUNTED' || st.includes('THẤP CÒI NẶNG') || r.heightClassification === 'SEVERELY_STUNTED') {
                            statusLabel = 'Thấp còi nặng';
                            statusColor = 'bg-rose-100 text-rose-800 border border-rose-300 font-black';
                          } else if (st === 'STUNTED' || st.includes('THẤP CÒI') || r.heightClassification === 'STUNTED') {
                            statusLabel = 'Thấp còi';
                            statusColor = 'bg-amber-100 text-amber-800 border border-amber-300 font-bold';
                          } else if (st === 'SEVERELY_WASTED' || st.includes('GẦY CÒM NẶNG') || r.bmiClassification === 'SEVERELY_WASTED') {
                            statusLabel = 'Gầy còm nặng';
                            statusColor = 'bg-rose-100 text-rose-800 border border-rose-300 font-black';
                          } else if (st === 'WASTED' || st.includes('GẦY CÒM') || r.bmiClassification === 'WASTED') {
                            statusLabel = 'Gầy còm';
                            statusColor = 'bg-orange-100 text-orange-800 border border-orange-300 font-bold';
                          } else if (st === 'SEVERELY_UNDERWEIGHT' || st.includes('NHẸ CÂN NẶNG') || r.weightClassification === 'SEVERELY_UNDERWEIGHT') {
                            statusLabel = 'Nhẹ cân nặng';
                            statusColor = 'bg-rose-100 text-rose-800 border border-rose-300 font-black';
                          } else if (st === 'UNDERWEIGHT' || st.includes('NHẸ CÂN') || r.weightClassification === 'UNDERWEIGHT') {
                            statusLabel = 'Nhẹ cân';
                            statusColor = 'bg-orange-100 text-orange-800 border border-orange-300 font-bold';
                          }

                          return (
                            <tr
                              key={r.id}
                              className={`hover:bg-teal-50/30 transition cursor-pointer ${
                                selectedChildId === r.childId ? 'bg-teal-50/50' : ''
                              }`}
                              onClick={() => setSelectedChildId(r.childId)}
                            >
                              <td className="py-3.5 px-4">
                                <div className="font-bold text-slate-900">{r.child?.fullName}</div>
                                <div className="text-[11px] text-slate-400">
                                  {r.child?.studentCode} • {group.className}
                                </div>
                              </td>
                              <td className="py-3.5 px-3 font-semibold text-slate-700">
                                {new Date(r.measurementDate).toLocaleDateString('vi-VN')}
                              </td>
                              <td className="py-3.5 px-3 font-semibold text-slate-700">{r.ageInMonths} thg</td>
                              <td className="py-3.5 px-3 font-black text-slate-900">{r.weightKg} kg</td>
                              <td className="py-3.5 px-3 font-black text-slate-900">{r.heightCm} cm</td>
                              <td className="py-3.5 px-3 font-semibold text-slate-700">{r.bmi}</td>
                              <td className="py-3.5 px-3">
                                <div className="flex items-center gap-1.5 font-mono text-[11px]">
                                  <span className={`px-1.5 py-0.5 rounded border ${wClass}`} title="Cân nặng theo tuổi (WAZ)">
                                    W: {r.waz > 0 ? `+${r.waz}` : r.waz}
                                  </span>
                                  <span className={`px-1.5 py-0.5 rounded border ${hClass}`} title="Chiều cao theo tuổi (HAZ)">
                                    H: {r.haz > 0 ? `+${r.haz}` : r.haz}
                                  </span>
                                  <span className={`px-1.5 py-0.5 rounded border ${bClass}`} title="BMI theo tuổi (BAZ)">
                                    B: {r.baz > 0 ? `+${r.baz}` : r.baz}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3.5 px-3">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] ${statusColor}`}>
                                  {statusLabel}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenEdit(r);
                                      }}
                                      title="Sửa số liệu đo (UC-74)"
                                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg border border-teal-200 transition shadow-2xs"
                                    >
                                      <Edit3 className="w-3.5 h-3.5 text-teal-600" />
                                      <span>Sửa số liệu đo</span>
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteRecord(r.id, r.child?.fullName || 'học sinh');
                                      }}
                                      title="Xóa bản ghi sai sót"
                                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedChildId(r.childId);
                                    }}
                                    className={`px-2.5 py-1 text-xs font-bold rounded-lg flex items-center gap-1 transition ${
                                      selectedChildId === r.childId
                                        ? 'bg-teal-600 text-white'
                                        : 'text-teal-700 hover:bg-teal-50'
                                    }`}
                                  >
                                    Biểu đồ
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200/90 p-12 text-center text-slate-400">
            Không tìm thấy bản ghi cân đo nào phù hợp bộ lọc.
          </div>
        )}
      </div>

      {/* ─── 6. CREATE RECORD MODAL ─── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-teal-600" />
                <h3 className="font-bold text-slate-900 text-base">Ghi Nhận Chỉ Số Cân Đo</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRecord} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Chọn Học Sinh *</label>
                <select
                  required
                  value={formData.childId}
                  onChange={(e) => setFormData({ ...formData, childId: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-semibold"
                >
                  <option value="">-- Chọn học sinh --</option>
                  {childrenList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} ({c.studentCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ngày Đo *</label>
                <input
                  type="date"
                  required
                  value={formData.measurementDate}
                  onChange={(e) => setFormData({ ...formData, measurementDate: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Cân Nặng (kg) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="3"
                    max="60"
                    required
                    placeholder="VD: 14.5"
                    value={formData.weightKg || ''}
                    onChange={(e) => setFormData({ ...formData, weightKg: parseFloat(e.target.value) || ('' as any) })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Chiều Cao (cm) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="40"
                    max="150"
                    required
                    placeholder="VD: 95.0"
                    value={formData.heightCm || ''}
                    onChange={(e) => setFormData({ ...formData, heightCm: parseFloat(e.target.value) || ('' as any) })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-bold"
                  />
                </div>
              </div>

              {/* Real-time BMI preview with dynamic alert styling (UC-79) */}
              {(() => {
                const createBmiStatus = getBmiStatusInfo(previewBmi);
                return (
                  <div className={`p-3.5 rounded-2xl border transition-all duration-300 space-y-2 ${createBmiStatus.containerStyle}`}>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 font-bold">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Xem trước BMI tức thời:</span>
                      </div>
                      <span className="font-mono font-black text-sm">
                        {previewBmi > 0 ? `${previewBmi} kg/m²` : '--'}
                      </span>
                    </div>
                    {previewBmi > 0 && (
                      <>
                        <div className="flex items-center justify-between pt-1 border-t border-current/10 text-[11px]">
                          <span>Thể trạng ước tính:</span>
                          <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold ${createBmiStatus.color}`}>
                            {createBmiStatus.label}
                          </span>
                        </div>
                        <div className="text-[11px] font-semibold pt-1 border-t border-current/10 flex items-center gap-1.5">
                          <span>{createBmiStatus.alertMessage}</span>
                        </div>
                      </>
                    )}
                    <div className="text-[10px] opacity-75 italic text-right">
                      Công thức WHO: BMI = weightKg / ((heightCm / 100)²)
                    </div>
                  </div>
                );
              })()}

              {/* Upsert duplicate prevention note */}
              <div className="px-3 py-2 rounded-xl bg-blue-50/90 border border-blue-200/70 text-[11px] text-blue-900 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span className="leading-snug">
                  <strong>Cơ chế chống trùng lặp (Upsert):</strong> Nếu học sinh đã có bản ghi trong ngày này, hệ thống sẽ tự động cập nhật số đo mới và tính lại Z-score thay vì tạo bản ghi trùng.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ghi Chú Sức Khỏe / Thể Lực</label>
                <textarea
                  rows={2}
                  value={formData.healthNotes}
                  onChange={(e) => setFormData({ ...formData, healthNotes: e.target.value })}
                  placeholder="Ghi chú về thói quen ăn uống, giấc ngủ hoặc tư vấn phụ huynh..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold rounded-xl text-slate-600 hover:bg-slate-100 transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-md transition disabled:opacity-50"
                >
                  {submitting ? 'Đang lưu...' : 'Lưu chỉ số WHO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── 7. EDIT RECORD MODAL (UC-74: Cập Nhật Chỉ Số Chiều Cao & Cân Nặng) ─── */}
      {editingRecord && (() => {
        const bmiStatus = getBmiStatusInfo(previewEditBmi);
        const prevBmi = Number(editingRecord.bmi) || 0;
        const diffBmi = previewEditBmi > 0 && prevBmi > 0 ? Number((previewEditBmi - prevBmi).toFixed(2)) : 0;

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200 border border-slate-100 max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center shadow-md">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        UC-74
                      </span>
                      <h3 className="font-black text-slate-900 text-sm">Cập Nhật Chỉ Số Chiều Cao & Cân Nặng</h3>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Chỉnh sửa số liệu đo khi có sai sót & tự động tính toán lại BMI, Z-score (WHO)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                  title="Đóng modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Thông tin học sinh cố định (Không cho phép đổi học sinh theo yêu cầu UC-74) */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Học sinh bản ghi đang sửa
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-full shadow-2xs">
                    <Lock className="w-3 h-3 text-slate-400" /> Cố định trên tiêu đề
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-sm">
                      {editingRecord.child?.fullName || 'Học sinh'}
                    </h4>
                    <p className="text-[11px] text-slate-500 font-mono">
                      Mã: {editingRecord.child?.studentCode} • {editingRecord.child?.class?.name || (editingRecord as any).childClassName || 'Lớp mầm non'}
                    </p>
                  </div>
                  <div className="text-right text-[11px]">
                    <span className="font-bold text-slate-700">
                      {editingRecord.child?.gender === 'FEMALE' ? '👧 Bé gái' : '👦 Bé trai'}
                    </span>
                    {editingRecord.child?.dateOfBirth && (
                      <div className="text-[10px] text-slate-400">
                        Sinh: {new Date(editingRecord.child.dateOfBirth).toLocaleDateString('vi-VN')}
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-amber-700/90 italic">
                  * Ghi chú nghiệp vụ: Thông tin học sinh được cố định, không được phép thay đổi sang học sinh khác.
                </p>
              </div>

              <form onSubmit={handleUpdateRecord} className="space-y-4 text-xs">
                {/* Ngày đo */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Ngày Đo Mới * <span className="text-[11px] font-normal text-slate-400">(YYYY-MM-DD)</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={editFormData.measurementDate}
                    onChange={(e) => setEditFormData({ ...editFormData, measurementDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white font-medium"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Thay đổi ngày đo sẽ làm thay đổi số tháng tuổi (ageInMonths) tại thời điểm đo để tra cứu chuẩn WHO.
                  </p>
                </div>

                {/* Cân nặng & Chiều cao */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Cân Nặng Mới (kg) *</label>
                    <input
                      type="number"
                      step="0.1"
                      min="3"
                      max="60"
                      required
                      placeholder="Ví dụ: 15.5"
                      value={editFormData.weightKg || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, weightKg: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-black text-slate-900"
                    />
                    <span className="text-[10px] text-slate-400">Giới hạn: 3.0 - 60.0 kg</span>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Chiều Cao Mới (cm) *</label>
                    <input
                      type="number"
                      step="0.1"
                      min="40"
                      max="150"
                      required
                      placeholder="Ví dụ: 102.0"
                      value={editFormData.heightCm || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, heightCm: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-black text-slate-900"
                    />
                    <span className="text-[10px] text-slate-400">Giới hạn: 40.0 - 150.0 cm</span>
                  </div>
                </div>

                {/* Xem trước BMI mới ước tính theo thời gian thực (UC-79) */}
                <div className={`p-3.5 rounded-2xl border transition-all duration-300 shadow-xs space-y-2 ${bmiStatus.containerStyle}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      BMI Mới Ước Tính (Thời gian thực):
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${bmiStatus.color}`}>
                      {bmiStatus.label}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between pt-1">
                    <div>
                      <span className="text-2xl font-black">{previewEditBmi}</span>
                      <span className="text-xs font-bold ml-1">kg/m²</span>
                    </div>
                    <div className="text-right text-[11px] text-slate-600">
                      <span>BMI cũ: <strong className="font-mono">{editingRecord.bmi}</strong></span>
                      {diffBmi !== 0 && (
                        <span className={`ml-1.5 font-bold ${diffBmi > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          ({diffBmi > 0 ? `+${diffBmi}` : diffBmi})
                        </span>
                      )}
                    </div>
                  </div>

                  {previewEditBmi > 0 && (
                    <div className="text-[11px] font-semibold py-1.5 px-3 rounded-xl bg-white/70 border border-current/10">
                      {bmiStatus.alertMessage}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-current/10 text-[11px] opacity-80">
                    <div>
                      <span>Chiều cao: </span>
                      <span className="line-through mr-1">{editingRecord.heightCm}</span>
                      <strong className="font-bold">{editFormData.heightCm || 0} cm</strong>
                    </div>
                    <div>
                      <span>Cân nặng: </span>
                      <span className="line-through mr-1">{editingRecord.weightKg}</span>
                      <strong className="font-bold">{editFormData.weightKg || 0} kg</strong>
                    </div>
                  </div>

                  <p className="text-[10px] opacity-75 leading-tight">
                    ⚡ Hệ thống sẽ tự động gọi WhoZscoreService để tính toán lại toàn bộ chỉ số Z-Score (WAZ, HAZ, BAZ) và phân loại dinh dưỡng ngay khi lưu.
                  </p>
                </div>

                {/* Ghi chú điều chỉnh */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Ghi Chú Điều Chỉnh (healthNotes)</label>
                  <textarea
                    rows={2}
                    value={editFormData.healthNotes}
                    onChange={(e) => setEditFormData({ ...editFormData, healthNotes: e.target.value })}
                    placeholder="Lý do điều chỉnh (sai sót nhập liệu, kiểm tra lại thước đo, tái cân...)"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  ></textarea>
                </div>

                {/* Modal Footer Actions */}
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingRecord(null)}
                    className="px-4 py-2 font-bold rounded-xl text-slate-600 hover:bg-slate-100 transition text-xs"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 font-bold rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-md transition disabled:opacity-50 text-xs flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{submitting ? 'Đang lưu & tính lại WHO...' : 'Lưu Thay Đổi & Tính Lại WHO'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ─── 8. IMPORT MEASUREMENTS MODAL ─── */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-sm">Nhập Dữ Liệu Cân Đo Hàng Loạt</h3>
                  <p className="text-[11px] text-slate-400">Định dạng CSV hoặc dán trực tiếp từ bảng tính Excel</p>
                </div>
              </div>
              <button onClick={() => setIsImportModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-teal-50 border border-teal-200 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-teal-900">Cấu trúc cột dữ liệu:</span>
                  <button
                    onClick={() => setImportText(sampleGrowthCsv)}
                    className="text-teal-700 font-bold hover:underline flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" /> Dán dữ liệu mẫu
                  </button>
                </div>
                <code className="block bg-white p-2 rounded-xl border border-teal-200/80 text-[11px] text-slate-700 font-mono overflow-x-auto whitespace-pre">
                  Mã học sinh, Ngày đo (YYYY-MM-DD), Cân nặng (kg), Chiều cao (cm), Ghi chú
                </code>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Dán nội dung bảng tính hoặc CSV vào đây:
                </label>
                <textarea
                  rows={6}
                  placeholder={`Ví dụ:\nHS-2026-0001, 2026-10-01, 15.2, 98.5, Đợt khám định kỳ\nHS-2026-0002, 2026-10-01, 14.8, 96.0, `}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  className="w-full p-3 font-mono text-xs text-slate-800 bg-slate-50 focus:bg-white rounded-2xl border border-slate-200 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>

              {importResult && (
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex items-center gap-2 text-emerald-700 font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Đã ghi nhận thành công {importResult.count} bản ghi cân đo!</span>
                  </div>
                  {importResult.errors.length > 0 && (
                    <div className="space-y-1">
                      <span className="font-bold text-rose-600">Các lỗi cần lưu ý ({importResult.errors.length}):</span>
                      <ul className="list-disc pl-5 text-[11px] text-rose-600 max-h-28 overflow-y-auto">
                        {importResult.errors.map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 font-bold rounded-xl text-slate-600 hover:bg-slate-100 transition text-xs"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={importing || !importText.trim()}
                onClick={handleImportSubmit}
                className="px-5 py-2 font-bold rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-md transition disabled:opacity-50 text-xs flex items-center gap-2"
              >
                <UploadCloud className="w-4 h-4" />
                <span>{importing ? 'Đang nhập...' : 'Bắt đầu nhập dữ liệu'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
