import { getLocale, t as translateText } from '../core/i18n/language';
import { useLanguage } from '../core/i18n/useLanguage';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertOctagon,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChefHat,
  Clock,
  Flame,
  RotateCcw,
  Search,
  ShieldCheck,
  Truck,
  Users,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { attendanceApi } from "../features/attendance/api/attendanceApi";
import { Link } from "react-router-dom";
import { usePublishedDay } from "../features/menus/hooks/usePublishedMenus";
import { useAuthStore } from "../core/stores/auth.store";
import {
  getSchoolDate,
  isToddler,
  KitchenData,
  KitchenStatus,
  normalizeKitchenData,
  normalizeSearch,
  statusLabels,
} from "../features/kitchen/utils/kds-data";
import "../features/kitchen/kitchen-display.css";

const schoolTime = () =>
  new Date().toLocaleTimeString(getLocale(), {
    timeZone: "Asia/Ho_Chi_Minh",
    hour12: false,
  });
const displayCount = (value: number | null | undefined) =>
  value == null ? "—" : value.toLocaleString(getLocale());
const finished = (status: KitchenStatus) =>
  status === "COMPLETED" || status === "DELIVERED";
const preparing = (status: KitchenStatus) =>
  status === "PREPARING" || status === "PORTIONING";

function Metric({
  label,
  value,
  unit,
  icon,
  tone,
  children,
}: {
  label: string;
  value: React.ReactNode;
  unit: string;
  icon: React.ReactNode;
  tone: string;
  children: React.ReactNode;
}) {
  useLanguage();
  return (
    <article className={`kds-metric kds-tone-${tone}`}>
      <div className="kds-metric-label">
        <span>{translateText(label)}</span>
        <span className="kds-metric-icon">{translateText(icon)}</span>
      </div>
      <div className="kds-metric-value">
        <strong>{translateText(value)}</strong>
        <span>{translateText(unit)}</span>
      </div>
      <div className="kds-metric-foot">{children}</div>
    </article>
  );
}

export const KitchenDisplayLayout: React.FC = () => {
  useLanguage();
  const { user } = useAuthStore();
  const [currentDate, setCurrentDate] = useState(getSchoolDate);
  const published = usePublishedDay(currentDate);
  const lunchDishes = published.meals
    .filter((meal) => meal.mealType === "LUNCH")
    .flatMap((meal) => meal.dishes);
  const [data, setData] = useState<KitchenData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [pendingClasses, setPendingClasses] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const requestRef = useRef(0);
  const pendingRef = useRef(new Set<string>());
  const dateRef = useRef(currentDate);
  dateRef.current = currentDate;

  const loadKdsData = useCallback(async () => {
    const request = ++requestRef.current;
    setIsLoading(true);
    setLoadError("");
    try {
      const [kds, headcount] = await Promise.allSettled([
        attendanceApi.getKitchenKdsData(currentDate),
        attendanceApi.getSchoolHeadcountSummary(currentDate),
      ]);
      if (request !== requestRef.current) return;
      if (kds.status === "rejected") throw kds.reason;
      const attendance =
        headcount.status === "fulfilled" &&
        headcount.value?.date === currentDate
          ? headcount.value
          : undefined;
      const next = normalizeKitchenData(kds.value, attendance);
      setData(next);
      const receivedAt = next.lastUpdated
        ? new Date(next.lastUpdated)
        : new Date();
      setUpdatedAt(
        Number.isNaN(receivedAt.getTime())
          ? schoolTime()
          : receivedAt.toLocaleTimeString(getLocale(), {
              timeZone: "Asia/Ho_Chi_Minh",
            }),
      );
    } catch {
      if (request === requestRef.current)
        setLoadError(
          "Không tải được dữ liệu báo bếp. Vui lòng kiểm tra kết nối và thử lại.",
        );
    } finally {
      if (request === requestRef.current) setIsLoading(false);
    }
  }, [currentDate]);

  useEffect(() => {
    setData(null);
    setUpdatedAt("");
    setActionError("");
    void loadKdsData();
    return () => {
      requestRef.current++;
    };
  }, [loadKdsData]);

  const handleUpdateStatus = async (
    classId: string,
    status: "PREPARING" | "COMPLETED",
  ) => {
    if (pendingRef.current.has(classId) || currentDate !== getSchoolDate())
      return;
    const date = currentDate;
    pendingRef.current.add(classId);
    setPendingClasses([...pendingRef.current]);
    setActionError("");
    try {
      await attendanceApi.updateKitchenStatus({
        classId,
        status,
        actorName: user?.fullName || "Nhân viên bếp",
      });
      if (date !== dateRef.current) return;
      setData((previous) =>
        previous
          ? {
              ...previous,
              classes: previous.classes.map((item) =>
                item.classId === classId
                  ? { ...item, kitchenStatus: status }
                  : item,
              ),
            }
          : previous,
      );
    } catch {
      if (date === dateRef.current)
        setActionError(
          "Chưa lưu được trạng thái bếp. Vui lòng thử lại; trạng thái lớp được giữ nguyên.",
        );
    } finally {
      pendingRef.current.delete(classId);
      setPendingClasses([...pendingRef.current]);
    }
  };

  const filteredClasses = useMemo(
    () =>
      (data?.classes || []).filter((item) => {
        const matchSearch = normalizeSearch(
          `${item.className} ${item.roomNumber} ${item.teacherName}`,
        ).includes(normalizeSearch(searchQuery));
        const matchGrade =
          selectedGrade === "ALL" ||
          (item.gradeLevel &&
            (selectedGrade === "TODDLER"
              ? isToddler(item.gradeLevel)
              : !isToddler(item.gradeLevel)));
        const matchStatus =
          selectedStatus === "ALL" ||
          (selectedStatus === "LOCKED" && item.isLocked === true) ||
          (selectedStatus === "UNLOCKED" && item.isLocked === false) ||
          (selectedStatus === "PREPARING" && preparing(item.kitchenStatus)) ||
          (selectedStatus === "COMPLETED" && finished(item.kitchenStatus)) ||
          (selectedStatus === "READY_DELIVERY" &&
            item.kitchenStatus === "READY_DELIVERY");
        return matchSearch && matchGrade && matchStatus;
      }),
    [data, searchQuery, selectedGrade, selectedStatus],
  );

  const summary = data?.summary;
  const completion =
    summary?.locked != null && summary.total > 0
      ? Math.min(100, Math.round((summary.locked / summary.total) * 100))
      : 0;
  const historical = currentDate !== getSchoolDate();
  const hasFilters =
    searchQuery || selectedGrade !== "ALL" || selectedStatus !== "ALL";
  const resetFilters = () => {
    setSearchQuery("");
    setSelectedGrade("ALL");
    setSelectedStatus("ALL");
  };

  return (
    <>
      <div className="kds-display">
        <main className="kds-main">
          <div className="kds-page-heading">
            <div>
              <span className="kds-eyebrow">{translateText("BẾP BÁN TRÚ")}</span>
              <h2>{translateText("Tổng quan điều phối")}</h2>
            </div>
            <p className="kds-update">
              {translateText(isLoading
                ? "Đang tải dữ liệu…"
                : updatedAt
                  ? `Cập nhật lúc ${updatedAt}`
                  : "Chưa có dữ liệu")}
              {historical && (
                <span className="kds-tag">{translateText("Đang xem ngày đã chọn")}</span>
              )}
            </p>
          </div>
          {loadError && (
            <div className="kds-error" role="alert">
              <AlertOctagon size={19} />
              <span>
                {translateText(loadError)}
                {translateText(data && " Đang hiển thị dữ liệu tải gần nhất.")}
              </span>
              <button
                onClick={() => {
                  void loadKdsData();
                  void published.reload();
                }}
                disabled={isLoading}
              >{translateText("Thử lại ")}<RotateCcw size={14} />
              </button>
            </div>
          )}
          {actionError && (
            <div className="kds-error" role="alert">
              <AlertOctagon size={19} />
              <span>{translateText(actionError)}</span>
              <button
                onClick={() => setActionError("")}
                aria-label={translateText("Đóng thông báo")}
              >
                <X size={17} />
              </button>
            </div>
          )}
          <section
            className="kds-metrics"
            aria-label={translateText("Thống kê suất ăn")}
            aria-busy={isLoading}
          >
            <Metric
              label={translateText("Tổng suất trưa chính")}
              value={displayCount(summary?.lunch)}
              unit="suất ăn"
              tone="green"
              icon={<UtensilsCrossed size={17} />}
            >
              <span>{translateText("Cơm mềm ")}<b>{translateText(displayCount(summary?.kindergarten))}</b>
              </span>
              <span>{translateText("Cháo / xay ")}<b>{translateText(displayCount(summary?.toddler))}</b>
              </span>
            </Metric>
            <Metric
              label={translateText("Bữa phụ xế")}
              value={displayCount(summary?.snack)}
              unit="phần ăn xế"
              tone="blue"
              icon={<Clock size={17} />}
            >
              <span>{translateText("Khung giờ phục vụ")}</span>
              <b>14:30</b>
            </Metric>
            <Metric
              label={translateText("Học sinh vắng")}
              value={displayCount(summary?.absent)}
              unit="trẻ vắng"
              tone="rose"
              icon={<Users size={17} />}
            >
              <span>
                {translateText(summary?.absent == null
                  ? "Chưa có số liệu điểm danh"
                  : "Theo điểm danh ngày đã chọn")}
              </span>
            </Metric>
            <Metric
              label={translateText("Tiến độ báo bếp")}
              value={
                <>
                  {translateText(displayCount(summary?.locked))}
                  <small> / {translateText(displayCount(summary?.total))}</small>
                </>
              }
              unit="lớp đã chốt"
              tone="amber"
              icon={<CheckCircle2 size={17} />}
            >
              <div
                className="kds-progress"
                role="progressbar"
                aria-label={translateText("Tỷ lệ lớp chốt báo bếp")}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={summary?.locked == null ? undefined : completion}
              >
                <span style={{ width: `${completion}%` }} />
              </div>
              <b>
                {translateText(summary?.locked == null ? "Chưa có dữ liệu" : `${completion}%`)}
              </b>
            </Metric>
            <Metric
              label={translateText("Suất ăn riêng")}
              value={displayCount(summary?.special)}
              unit="khay riêng"
              tone="red"
              icon={<ShieldCheck size={17} />}
            >
              <span>
                {translateText(data
                  ? `${data.alerts.length} yêu cầu cần kiểm tra`
                  : "Đang kiểm tra yêu cầu")}
              </span>
              <AlertOctagon size={14} />
            </Metric>
          </section>

          <section className="kds-overview" aria-label={translateText("Dị ứng và thực đơn")}>
            <article
              className={`kds-panel kds-allergies ${data?.alerts.length ? "has-alerts" : ""}`}
            >
              <div className="kds-panel-heading">
                <div>
                  <span className="kds-section-icon red">
                    <ShieldCheck size={20} />
                  </span>
                  <h2>{translateText("Dị ứng & suất ăn riêng")}{" "}
                    <span className="kds-count">
                      {translateText(data ? data.alerts.length : "—")}
                    </span>
                  </h2>
                </div>
                <span className="kds-tag">{translateText("Ưu tiên kiểm tra")}</span>
              </div>
              <div className="kds-allergy-list">
                {!data ? (
                  <div className="kds-empty">
                    <ShieldCheck size={30} />
                    <strong>
                      {translateText(isLoading
                        ? "Đang tải yêu cầu ăn riêng…"
                        : "Chưa tải được yêu cầu ăn riêng")}
                    </strong>
                    <p>{translateText("Kiểm tra dữ liệu trước khi chuẩn bị suất ăn.")}</p>
                  </div>
                ) : data.alerts.length === 0 ? (
                  <div className="kds-empty kds-safe">
                    <span className="kds-empty-icon">
                      <ShieldCheck size={26} />
                    </span>
                    <strong>{translateText("Không có yêu cầu ăn riêng trong dữ liệu")}</strong>
                    <p>{translateText("Tiếp tục kiểm tra nhãn suất ăn trước khi giao lên lớp.")}</p>
                  </div>
                ) : (
                  data.alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`kds-allergy-item ${alert.urgent ? "urgent" : ""}`}
                    >
                      <div className="kds-allergy-title">
                        <strong>{alert.childName}</strong>
                        <span className="kds-tag">
                          {alert.className || translateText("Chưa có lớp")}
                        </span>
                        <span className="kds-severity">{translateText(alert.severity)}</span>
                      </div>
                      <p>
                        <b>{translateText("Yêu cầu:")}</b>{" "}
                        {translateText(alert.allergen || "Cần đối chiếu với giáo viên")}
                      </p>
                      {alert.replacementMeal && (
                        <div className="kds-replacement">
                          <ChefHat size={15} />
                          <span>
                            <b>{translateText("Suất thay thế:")}</b> {translateText(alert.replacementMeal)}
                          </span>
                        </div>
                      )}
                      {alert.notes && (
                        <p className="kds-note">{translateText("Ghi chú: ")}{alert.notes}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
              <footer className="kds-allergy-footer">
                <AlertOctagon size={14} />
                <span>{translateText("Kiểm tra tem nhãn và tách riêng khay dị ứng trước khi chuyển lên lớp.")}</span>
              </footer>
            </article>
            <div className="kds-side-panels">
              <article className="kds-panel kds-menu">
                <div className="kds-panel-heading">
                  <div>
                    <span className="kds-section-icon amber">
                      <UtensilsCrossed size={20} />
                    </span>
                    <h2>{translateText("Thực đơn trưa chính")}</h2>
                  </div>
                  <Link className="kds-tag" to="/kitchen/menus">{translateText("Xem thực đơn đã công bố")}</Link>
                </div>
                <div className="kds-menu-grid">
                  {published.loading ? (
                    <div className="kds-menu-empty" role="status">{translateText("Đang tải thực đơn đã công bố…")}</div>
                  ) : published.error ? (
                    <div className="kds-menu-empty" role="alert">
                      {translateText(published.error)}
                    </div>
                  ) : lunchDishes.length ? (
                    lunchDishes.map((dish, index) => (
                      <div className="kds-dish" key={dish.id + "-" + index}>
                        <span>{translateText(dish.category)}</span>
                        <h3>{dish.name}</h3>
                        <div>
                          <span>
                            {translateText(dish.portionSizeG === null
                              ? "Chưa có định lượng"
                              : dish.portionSizeG + " g")}
                          </span>
                          <b>
                            {translateText(dish.calories === null
                              ? "—"
                              : dish.calories + " kcal")}
                          </b>
                        </div>
                        <small className="block text-[9px] text-slate-500 mt-2">
                          {translateText(dish.source)}
                        </small>
                      </div>
                    ))
                  ) : (
                    <div className="kds-menu-empty">{translateText("Chưa có thực đơn trưa đã công bố cho ngày đã chọn.")}</div>
                  )}
                </div>
              </article>
            </div>
          </section>

          <section
            className="kds-panel kds-coordination"
            aria-labelledby="kds-coordination-title"
          >
            <div className="kds-coordination-heading">
              <div>
                <span className="kds-eyebrow">{translateText("ĐIỀU PHỐI THEO LỚP")}</span>
                <h2 id="kds-coordination-title">{translateText("Bảng khẩu phần")}{" "}
                  <span className="kds-count">
                    {translateText(data ? data.classes.length : "—")}{translateText(" lớp")}</span>
                </h2>
                <p>{translateText("Theo dõi số lượng và tiến độ chuẩn bị suất ăn cho từng lớp.")}</p>
              </div>
              <div className="kds-legend">
                <span>
                  <i />{translateText("Chờ tiếp nhận")}</span>
                <span>
                  <i className="amber" />{translateText("Đang chuẩn bị")}</span>
                <span>
                  <i className="green" />{translateText("Đã xuất khay")}</span>
              </div>
            </div>
            <div className="kds-filter-bar">
              <label className="kds-search">
                <Search size={17} />
                <input
                  aria-label={translateText("Tìm lớp, phòng hoặc giáo viên")}
                  placeholder={translateText("Tìm tên lớp, phòng, giáo viên…")}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
                {searchQuery && (
                  <button
                    aria-label={translateText("Xóa tìm kiếm")}
                    onClick={() => setSearchQuery("")}
                  >
                    <X size={15} />
                  </button>
                )}
              </label>
              <select
                aria-label={translateText("Lọc khối lớp")}
                value={selectedGrade}
                onChange={(event) => setSelectedGrade(event.target.value)}
              >
                <option value="ALL">{translateText("Tất cả khối lớp")}</option>
                <option value="TODDLER">{translateText("Nhà trẻ · Cháo / xay")}</option>
                <option value="KINDERGARTEN">{translateText("Mẫu giáo · Cơm mềm")}</option>
              </select>
              <select
                aria-label={translateText("Lọc trạng thái")}
                value={selectedStatus}
                onChange={(event) => setSelectedStatus(event.target.value)}
              >
                <option value="ALL">{translateText("Tất cả trạng thái")}</option>
                <option value="LOCKED">{translateText("Đã chốt báo bếp")}</option>
                <option value="UNLOCKED">{translateText("Chưa chốt báo bếp")}</option>
                <option value="PREPARING">{translateText("Đang chuẩn bị / chia suất")}</option>
                <option value="READY_DELIVERY">{translateText("Sẵn sàng giao")}</option>
                <option value="COMPLETED">{translateText("Đã xuất khay / giao lớp")}</option>
              </select>
              <span className="kds-filter-result">{translateText("Hiển thị ")}<b>{filteredClasses.length}</b> /{" "}
                {data?.classes.length || 0}{translateText(" lớp")}</span>
              {hasFilters && (
                <button className="kds-reset" onClick={resetFilters}>{translateText("Xóa bộ lọc")}</button>
              )}
            </div>
            {historical && (
              <div className="kds-date-notice">
                <Calendar size={15} />{translateText("Đang xem ngày ")}{translateText(currentDate.split("-").reverse().join("/"))}{translateText(". Chỉ cập nhật tiến độ cho ngày hôm nay.")}<button onClick={() => setCurrentDate(getSchoolDate())}>{translateText("Về hôm nay ")}<ArrowRight size={14} />
                </button>
              </div>
            )}
            <div className="kds-class-grid" aria-busy={isLoading}>
              {!data && isLoading
                ? Array.from({ length: 4 }, (_, index) => (
                    <div
                      className="kds-skeleton-card"
                      key={index}
                      aria-hidden="true"
                    >
                      <span />
                      <span />
                      <div />
                      <span />
                    </div>
                  ))
                : filteredClasses.map((item) => {
                    const done = finished(item.kitchenStatus);
                    const busy = pendingClasses.includes(item.classId);
                    const cannotUpdate =
                      busy ||
                      historical ||
                      !item.classId;
                    const reason = historical
                      ? translateText("Chỉ cập nhật tiến độ ngày hôm nay")
                      : undefined;
                    return (
                      <article
                        className={`kds-class-card ${done ? "completed" : preparing(item.kitchenStatus) ? "preparing" : ""}`}
                        key={item.classId}
                      >
                        <div className="kds-class-heading">
                          <h3>{item.className}</h3>
                          <span
                            className={`kds-lock ${item.isLocked === true ? "locked" : item.isLocked === false ? "waiting" : ""}`}
                          >
                            {item.isLocked === true ? (
                              <CheckCircle2 size={11} />
                            ) : (
                              <Clock size={11} />
                            )}
                            {translateText(item.isLocked === true
                              ? "Đã chốt"
                              : item.isLocked === false
                                ? "Chờ chốt"
                                : "Chưa rõ chốt")}
                          </span>
                        </div>
                        <p className="kds-teacher">
                          {item.roomNumber && (
                            <span>{translateText("Phòng ")}{translateText(item.roomNumber)} · </span>
                          )}{translateText("GV: ")}{item.teacherName || translateText("Chưa có thông tin")}
                        </p>
                        <span className="kds-grade">{translateText(item.gradeLabel)}</span>
                        <div className="kds-portions">
                          <div>
                            <span>{translateText("Bữa trưa")}</span>
                            <strong>{translateText(displayCount(item.lunchCount))}</strong>
                            <small>{translateText("suất")}</small>
                          </div>
                          <div>
                            <span>{translateText("Bữa xế")}</span>
                            <strong>{translateText(displayCount(item.snackCount))}</strong>
                            <small>{translateText("phần")}</small>
                          </div>
                          <div>
                            <span>{translateText("Vắng mặt")}</span>
                            <strong>{translateText(displayCount(item.absentCount))}</strong>
                            <small>{translateText("trẻ")}</small>
                          </div>
                        </div>
                        {item.specialCount != null && item.specialCount > 0 && (
                          <p className="kds-class-special">
                            <ShieldCheck size={13} />
                            {item.specialCount}{translateText(" suất ăn riêng cần kiểm tra")}</p>
                        )}
                        <div className="kds-class-status">
                          <span>{translateText("Trạng thái bếp")}</span>
                          <b
                            className={
                              done
                                ? "green"
                                : preparing(item.kitchenStatus) ||
                                    item.kitchenStatus === "READY_DELIVERY"
                                  ? "amber"
                                  : ""
                            }
                          >
                            <i />
                            {translateText(busy
                              ? "Đang lưu…"
                              : statusLabels[item.kitchenStatus])}
                          </b>
                        </div>
                        <div className="kds-class-actions">
                          <button
                            title={translateText(reason)}
                            disabled={
                              cannotUpdate ||
                              preparing(item.kitchenStatus) ||
                              item.kitchenStatus === "READY_DELIVERY" ||
                              done
                            }
                            onClick={() =>
                              void handleUpdateStatus(item.classId, "PREPARING")
                            }
                          >
                            <Flame size={15} />{translateText("Chia khay")}</button>
                          <button
                            title={translateText(reason)}
                            className="kds-dispatch"
                            disabled={cannotUpdate || done}
                            onClick={() =>
                              void handleUpdateStatus(item.classId, "COMPLETED")
                            }
                          >
                            {done ? (
                              <CheckCircle2 size={15} />
                            ) : (
                              <Truck size={15} />
                            )}
                            {translateText(done ? "Đã xuất khay" : "Xuất khay")}
                          </button>
                        </div>
                      </article>
                    );
                  })}
            </div>
            {!isLoading && !filteredClasses.length && (
              <div className="kds-empty kds-class-empty">
                <Search size={28} />
                <strong>
                  {translateText(!data
                    ? "Chưa tải được danh sách lớp"
                    : hasFilters
                      ? "Không có lớp phù hợp"
                      : "Chưa có lớp trong ngày đã chọn")}
                </strong>
                <p>
                  {translateText(hasFilters
                    ? "Thử thay đổi từ khóa hoặc xóa bộ lọc để xem tất cả lớp."
                    : "Dữ liệu sẽ hiển thị khi có thông tin báo bếp.")}
                </p>
                {hasFilters && (
                  <button className="kds-control" onClick={resetFilters}>{translateText("Xóa bộ lọc")}</button>
                )}
              </div>
            )}
            <footer className="kds-coordination-footer">
              <span>
                <ShieldCheck size={14} />{translateText("Đối chiếu suất ăn và nhãn dị ứng trước khi bàn giao.")}</span>
              <span>{translateText("“—” : chưa có dữ liệu")}</span>
            </footer>
          </section>
        </main>
      </div>
    </>
  );
};
