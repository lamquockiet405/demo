import { normalizeSearch } from '../../../core/utils/search';
import { t as translateText, getLocale } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useEffect, useState } from "react";
import { apiClient } from "../../../core/api/axios";
import { fetchKitchenCollection } from "../../kitchen/api/kitchen.api";
import { SchoolPage, State, useSchoolResource } from "../components/SchoolUI";

export function PrincipalMenuVersionsPage() {
  useLanguage();
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [age, setAge] = useState(""),
    [menuId, setMenuId] = useState(""),
    [version, setVersion] = useState(""),
    [versionSearch, setVersionSearch] = useState("");
  const menus = useSchoolResource(
    () =>
      fetchKitchenCollection("/menus", {
        search,
        status: status || undefined,
        ageGroup: age || undefined,
      }),
    [search, status, age],
  );
  const versions = useSchoolResource(
    async () =>
      menuId ? (await apiClient.get(`/menus/${menuId}/versions`)).data : [],
    [menuId],
  );
  const detail = useSchoolResource(
    async () =>
      menuId && version
        ? (
            await apiClient.get(`/menus/${menuId}`, {
              params: { versionNumber: Number(version) },
            })
          ).data
        : null,
    [menuId, version],
  );
  useEffect(() => {
    if (menuId && !(menus.data || []).some((m) => String(m.id) === menuId)) {
      setMenuId("");
      setVersion("");
    }
  }, [menus.data]);
  const choose = (id: string) => {
    setVersion("");
    setVersionSearch("");
    setMenuId(id);
  };
  const rows =
    versions.error || versions.loading
      ? []
      : (versions.data || []).filter((v: any) =>
          normalizeSearch(`${v.versionNumber} ${v.changeNote || ""} ${v.createdByName || ""}`)
            .includes(normalizeSearch(versionSearch)),
        );
  return (
    <SchoolPage
      title={translateText("Lịch sử phiên bản thực đơn")}
      description={translateText("Tìm thực đơn, lọc lịch sử và xem nội dung của đúng phiên bản đã lưu. Phiên bản cũ chỉ được xem.")}
    >
      <div className="kp-filters flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            aria-label={translateText("Tìm thực đơn phiên bản")}
            placeholder={translateText("Tên thực đơn...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label={translateText("Trạng thái thực đơn phiên bản")}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">{translateText("Tất cả trạng thái")}</option>
            {[
              "DRAFT",
              "PENDING",
              "APPROVED",
              "PUBLISHED",
              "ARCHIVED",
              "REJECTED",
            ].map((s) => (
              <option key={s} value={s}>{translateText(s)}</option>
            ))}
          </select>
          <select
            aria-label={translateText("Nhóm tuổi thực đơn phiên bản")}
            value={age}
            onChange={(e) => setAge(e.target.value)}
          >
            <option value="">{translateText("Tất cả nhóm tuổi")}</option>
            <option value="NHA_TRE">{translateText("Nhà trẻ")}</option>
            <option value="MAU_GIAO">{translateText("Mẫu giáo")}</option>
          </select>
          <select
            aria-label={translateText("Chọn thực đơn xem phiên bản")}
            value={menuId}
            onChange={(e) => choose(e.target.value)}
          >
            <option value="">{translateText("Chọn thực đơn")}</option>
            {(menus.data || []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="kp-button"
          disabled={menus.loading || versions.loading}
          onClick={() => {
            menus.reload();
            versions.reload();
          }}
        >{translateText("Làm mới")}</button>
      </div>
      <State resource={menus} empty={!menus.data?.length} />
      {menuId && (
        <>
          <input
            className="kp-input"
            aria-label={translateText("Lọc lịch sử phiên bản")}
            placeholder={translateText("Số phiên bản, ghi chú, người tạo...")}
            value={versionSearch}
            onChange={(e) => setVersionSearch(e.target.value)}
          />
          <State resource={versions} empty={!rows.length} />
          <div className="overflow-auto bg-white border rounded-xl">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  {[
                    translateText("Phiên bản"),
                    translateText("Ghi chú thay đổi"),
                    translateText("Người tạo"),
                    translateText("Thời gian"),
                    translateText("Nội dung"),
                  ].map((h) => (
                    <th key={h} className="p-3">
                      {translateText(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((v: any) => (
                  <tr key={v.id} className="border-t">
                    <td className="p-3">{translateText(v.versionNumber)}</td>
                    <td className="p-3">{translateText(v.changeNote || "Chưa có ghi chú")}</td>
                    <td className="p-3">
                      {v.createdByName || translateText("Chưa ghi nhận")}
                    </td>
                    <td className="p-3">
                      {translateText(v.createdAt
                        ? new Date(v.createdAt).toLocaleString(getLocale())
                        : "Chưa ghi nhận")}
                    </td>
                    <td className="p-3">
                      <button
                        className="kp-button"
                        onClick={() => setVersion(String(v.versionNumber))}
                      >{translateText("Xem phiên bản ")}{translateText(v.versionNumber)}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {version && (
        <>
          <h2 className="font-bold">{translateText("Nội dung phiên bản ")}{translateText(version)}</h2>
          <State resource={detail} />
          {detail.data && !detail.error && (
            <div className="overflow-auto bg-white border rounded-xl">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr>
                    {[translateText("Ngày"), translateText("Bữa ăn"), translateText("Món ăn"), translateText("Khẩu phần (g)")].map((h) => (
                      <th className="p-3" key={h}>
                        {translateText(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(detail.data.days || []).flatMap((d: any) =>
                    (d.meals || []).flatMap((m: any) =>
                      (m.dishes || []).map((dish: any) => (
                        <tr
                          className="border-t"
                          key={`${d.id}-${m.id}-${dish.id}`}
                        >
                          <td className="p-3">{translateText(d.date)}</td>
                          <td className="p-3">{translateText(m.mealType)}</td>
                          <td className="p-3">{dish.dishName}</td>
                          <td className="p-3">
                            {translateText(dish.portionSizeG ?? "Chưa ghi nhận")}
                          </td>
                        </tr>
                      )),
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </SchoolPage>
  );
}
