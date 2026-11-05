import React, { useEffect, useState } from "react";
import { apiClient } from "../../../core/api/axios";
import { fetchKitchenCollection } from "../../kitchen/api/kitchen.api";
import { SchoolPage, State, useSchoolResource } from "../components/SchoolUI";

export function PrincipalMenuVersionsPage() {
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
          `${v.versionNumber} ${v.changeNote || ""} ${v.createdByName || ""}`
            .toLocaleLowerCase("vi")
            .includes(versionSearch.toLocaleLowerCase("vi")),
        );
  return (
    <SchoolPage
      title="Lịch sử phiên bản thực đơn"
      description="Tìm thực đơn, lọc lịch sử và xem nội dung của đúng phiên bản đã lưu. Phiên bản cũ chỉ được xem."
      actions={
        <button
          className="kp-button"
          disabled={menus.loading || versions.loading}
          onClick={() => {
            menus.reload();
            versions.reload();
          }}
        >
          Làm mới
        </button>
      }
    >
      <div className="kp-filters">
        <input
          aria-label="Tìm thực đơn phiên bản"
          placeholder="Tên thực đơn..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Trạng thái thực đơn phiên bản"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Tất cả trạng thái</option>
          {[
            "DRAFT",
            "PENDING",
            "APPROVED",
            "PUBLISHED",
            "ARCHIVED",
            "REJECTED",
          ].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          aria-label="Nhóm tuổi thực đơn phiên bản"
          value={age}
          onChange={(e) => setAge(e.target.value)}
        >
          <option value="">Tất cả nhóm tuổi</option>
          <option value="NHA_TRE">Nhà trẻ</option>
          <option value="MAU_GIAO">Mẫu giáo</option>
        </select>
        <select
          aria-label="Chọn thực đơn xem phiên bản"
          value={menuId}
          onChange={(e) => choose(e.target.value)}
        >
          <option value="">Chọn thực đơn</option>
          {(menus.data || []).map((m) => (
            <option key={m.id} value={m.id}>
              {m.title} · {m.startDate || m.weekStartDate}
            </option>
          ))}
        </select>
      </div>
      <State resource={menus} empty={!menus.data?.length} />
      {menuId && (
        <>
          <input
            className="kp-input"
            aria-label="Lọc lịch sử phiên bản"
            placeholder="Số phiên bản, ghi chú, người tạo..."
            value={versionSearch}
            onChange={(e) => setVersionSearch(e.target.value)}
          />
          <State resource={versions} empty={!rows.length} />
          <div className="overflow-auto bg-white border rounded-xl">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  {[
                    "Phiên bản",
                    "Ghi chú thay đổi",
                    "Người tạo",
                    "Thời gian",
                    "Nội dung",
                  ].map((h) => (
                    <th key={h} className="p-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((v: any) => (
                  <tr key={v.id} className="border-t">
                    <td className="p-3">{v.versionNumber}</td>
                    <td className="p-3">{v.changeNote || "Chưa có ghi chú"}</td>
                    <td className="p-3">
                      {v.createdByName || "Chưa ghi nhận"}
                    </td>
                    <td className="p-3">
                      {v.createdAt
                        ? new Date(v.createdAt).toLocaleString("vi-VN")
                        : "Chưa ghi nhận"}
                    </td>
                    <td className="p-3">
                      <button
                        className="kp-button"
                        onClick={() => setVersion(String(v.versionNumber))}
                      >
                        Xem phiên bản {v.versionNumber}
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
          <h2 className="font-bold">Nội dung phiên bản {version}</h2>
          <State resource={detail} />
          {detail.data && !detail.error && (
            <div className="overflow-auto bg-white border rounded-xl">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr>
                    {["Ngày", "Bữa ăn", "Món ăn", "Khẩu phần (g)"].map((h) => (
                      <th className="p-3" key={h}>
                        {h}
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
                          <td className="p-3">{d.date}</td>
                          <td className="p-3">{m.mealType}</td>
                          <td className="p-3">{dish.dishName}</td>
                          <td className="p-3">
                            {dish.portionSizeG ?? "Chưa ghi nhận"}
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
