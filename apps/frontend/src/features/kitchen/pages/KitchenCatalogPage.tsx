import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useMemo, useState } from "react";
import { Eye } from "lucide-react";
import { apiClient } from "../../../core/api/axios";
import { fetchKitchenCollection } from "../api/kitchen.api";
import {
  Modal,
  PageTitle,
  Pager,
  ReloadButton,
  ResourceState,
  useKitchenResource,
} from "../components/KitchenUI";
import { formatNumber, rowsOf } from "../utils/kitchen-operations";
import { normalizeSearch } from "../utils/kds-data";

const groupName = (item: any) =>
  typeof item.category === "object"
    ? item.category?.name || "Chưa phân nhóm"
    : item.categoryName || item.category || item.dishType || "Chưa phân nhóm";
const allergyNames = (item: any) =>
  rowsOf(item.allergens)
    .map((a) => a.name || a.allergenName || a.allergen?.name)
    .filter(Boolean)
    .concat(
      Array.isArray(item.allergens)
        ? item.allergens.filter((a) => typeof a === "string")
        : [],
    );

function CatalogDetail({
  kind,
  id,
  onClose,
}: {
  kind: "foods" | "dishes";
  id: string;
  onClose: () => void;
}) {
  useLanguage();
  const food = kind === "foods";
  const resource = useKitchenResource(
    async () =>
      (await apiClient.get(`/${kind}/${encodeURIComponent(id)}`)).data,
    [kind, id],
  );
  const item = resource.data;
  const nutrition = item?.nutrition;
  return (
    <Modal
      title={translateText(food ? "Chi tiết nguyên liệu" : "Chi tiết món ăn")}
      onClose={onClose}
    >
      <ResourceState resource={resource} />
      {item && (
        <>
          <h3 className="text-lg font-bold text-emerald-900 mb-4">
            {item.name}
          </h3>
          <dl className="kp-detail-list">
            <div>
              <dt>{translateText("Mã")}</dt>
              <dd>{translateText(item.code || `#${item.id}`)}</dd>
            </div>
            <div>
              <dt>{translateText("Nhóm")}</dt>
              <dd>{translateText(groupName(item))}</dd>
            </div>
            <div>
              <dt>{translateText(food ? "Đơn vị" : "Định lượng / suất")}</dt>
              <dd>
                {translateText(food
                  ? item.unit || item.defaultUnit || "—"
                  : `${formatNumber(item.standardServingSizeG)} g`)}
              </dd>
            </div>
            <div>
              <dt>{translateText(food ? "Tỷ lệ hao hụt" : "Trạng thái công thức")}</dt>
              <dd>
                {translateText(food
                  ? `${formatNumber(item.refuseRatePercent ?? item.refuse_rate_percent)} %`
                  : item.nutritionStatus === "VERIFIED"
                    ? "Đã xác minh"
                    : item.nutritionStatus === "REFERENCE"
                      ? "Tham khảo"
                      : "Chưa xác minh")}
              </dd>
            </div>
          </dl>
          <div className="kp-panel">
            <h2>{translateText("Dinh dưỡng ")}{translateText(food ? "trên 100g" : "theo suất")}</h2>
            <dl className="kp-detail-list">
              {[
                [
                  "Năng lượng",
                  "kcal",
                  food
                    ? (item.energyKcal ?? item.energyKcal100g)
                    : item.nutritionAvailable === false
                      ? null
                      : nutrition?.energyKcal,
                ],
                [
                  "Đạm",
                  "g",
                  food
                    ? item.proteinG
                    : item.nutritionAvailable === false
                      ? null
                      : nutrition?.proteinG,
                ],
                [
                  "Chất béo",
                  "g",
                  food
                    ? item.fatG
                    : item.nutritionAvailable === false
                      ? null
                      : nutrition?.fatG,
                ],
                [
                  "Tinh bột",
                  "g",
                  food
                    ? item.carbG
                    : item.nutritionAvailable === false
                      ? null
                      : nutrition?.carbG,
                ],
                [
                  "Canxi",
                  "mg",
                  food
                    ? item.calciumMg
                    : item.nutritionAvailable === false
                      ? null
                      : nutrition?.calciumMg,
                ],
                [
                  "Sắt",
                  "mg",
                  food
                    ? item.ironMg
                    : item.nutritionAvailable === false
                      ? null
                      : nutrition?.ironMg,
                ],
              ].map(([label, unit, value]) => (
                <div key={String(label)}>
                  <dt>{translateText(label)}</dt>
                  <dd>
                    {translateText(formatNumber(value))} {translateText(unit)}
                  </dd>
                </div>
              ))}
            </dl>
            <p>
              {translateText(allergyNames(item).length
                ? `Dị nguyên: ${allergyNames(item).join(", ")}`
                : "Chưa có dị nguyên được ghi nhận trong dữ liệu.")}
            </p>
          </div>
          {!food && (
            <section className="kp-panel">
              <h2>{translateText("Công thức / định lượng từng suất")}</h2>
              {rowsOf(
                item.recipeItems?.length ? item.recipeItems : item.recipes,
              ).length ? (
                <div className="kp-table-wrap">
                  <table className="kp-table">
                    <thead>
                      <tr>
                        <th>{translateText("Nguyên liệu")}</th>
                        <th>{translateText("Khối lượng tinh")}</th>
                        <th>{translateText("Khối lượng thô")}</th>
                        <th>{translateText("Ghi chú")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rowsOf(
                        item.recipeItems?.length
                          ? item.recipeItems
                          : item.recipes,
                      ).map((r, i) => (
                        <tr key={r.id || i}>
                          <td>
                            {r.ingredientName || r.food?.name || translateText("Chưa có tên")}
                          </td>
                          <td>
                            {translateText(formatNumber(
                              r.netWeightPerPortionG ?? r.netWeightG,
                            ))}{" "}{translateText("g")}</td>
                          <td>
                            {translateText(formatNumber(
                              r.grossWeightPerPortionG ?? r.grossWeightG,
                            ))}{" "}{translateText("g")}</td>
                          <td>{r.note || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>{translateText("Chưa có công thức định lượng.")}</p>
              )}
            </section>
          )}
          {(item.description ||
            item.cookingInstructions ||
            item.presentationNotes) && (
            <section className="kp-panel">
              <h2>{translateText("Mô tả / hướng dẫn chế biến")}</h2>
              <p className="kp-note-text">
                {translateText([
                  item.description,
                  item.cookingInstructions,
                  item.presentationNotes,
                ]
                  .filter(Boolean)
                  .join("\n"))}
              </p>
            </section>
          )}
        </>
      )}
    </Modal>
  );
}

export function KitchenCatalogPage({ kind }: { kind: "foods" | "dishes" }) {
  useLanguage();
  const food = kind === "foods";
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [allergen, setAllergen] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<string | null>(null);
  const resource = useKitchenResource(
    () => fetchKitchenCollection(`/${kind}`),
    [kind],
  );
  const categories = [...new Set((resource.data || []).map(groupName))].sort();
  const rows = useMemo(
    () =>
      (resource.data || []).filter(
        (item) =>
          (!category || groupName(item) === category) &&
          (!allergen ||
            (allergen === "WARNING"
              ? allergyNames(item).length > 0
              : allergyNames(item).length === 0)) &&
          (!status ||
            item.status === status ||
            (!item.status &&
              (status === "ACTIVE"
                ? item.isActive !== false
                : item.isActive === false))) &&
          normalizeSearch(`${item.name} ${item.code || ""}`).includes(
            normalizeSearch(search),
          ),
      ),
    [resource.data, category, allergen, status, search],
  );
  const filter = (setter: (s: string) => void, value: string) => {
    setter(value);
    setPage(1);
  };
  return (
    <>
      <PageTitle
        title={translateText(food ? "Nguyên liệu thực phẩm" : "Danh sách món ăn")}
        description={
          translateText(food
            ? "Tra cứu thành phần dinh dưỡng, nhóm thực phẩm, dị nguyên và tỷ lệ hao hụt."
            : "Xem thành phần công thức, định lượng và hướng dẫn chế biến; lọc theo nhóm, dị nguyên và trạng thái.")
        }
      >
        <ReloadButton loading={resource.loading} reload={resource.reload} />
      </PageTitle>
      <div className="kp-filters">
        <input
          type="search"
          aria-label={translateText(food ? "Tìm nguyên liệu" : "Tìm món ăn")}
          placeholder={translateText(food ? "Tìm tên, mã nguyên liệu…" : "Tìm tên món ăn…")}
          value={search}
          onChange={(e) => filter(setSearch, e.target.value)}
        />
        <select
          aria-label={translateText("Nhóm thực phẩm hoặc món ăn")}
          value={category}
          onChange={(e) => filter(setCategory, e.target.value)}
        >
          <option value="">{translateText("Tất cả nhóm")}</option>
          {categories.map((name) => (
            <option key={name} value={name}>
              {translateText(name)}
            </option>
          ))}
        </select>
        <select
          aria-label={translateText("Lọc dị nguyên")}
          value={allergen}
          onChange={(e) => filter(setAllergen, e.target.value)}
        >
          <option value="">{translateText("Tất cả dị nguyên")}</option>
          <option value="WARNING">{translateText("Có dị nguyên ghi nhận")}</option>
          <option value="SAFE">{translateText("Chưa ghi nhận dị nguyên")}</option>
        </select>
        <select
          aria-label={translateText("Trạng thái danh mục")}
          value={status}
          onChange={(e) => filter(setStatus, e.target.value)}
        >
          <option value="">{translateText("Tất cả trạng thái")}</option>
          <option value="ACTIVE">{translateText("Đang sử dụng")}</option>
          <option value="INACTIVE">{translateText("Ngừng sử dụng")}</option>
        </select>
        <button
          className="kp-button"
          onClick={() => {
            setSearch("");
            setCategory("");
            setAllergen("");
            setStatus("");
            setPage(1);
          }}
        >{translateText("Xóa bộ lọc")}</button>
      </div>
      <ResourceState resource={resource} empty={!rows.length} />
      {resource.data && (
        <>
          <div className="kp-table-wrap">
            <table className="kp-table">
              <thead>
                <tr>
                  <th>{translateText(food ? "Nguyên liệu" : "Món ăn")}</th>
                  <th>{translateText("Nhóm")}</th>
                  <th>{translateText(food ? "Năng lượng / 100g" : "Năng lượng / suất")}</th>
                  <th>{translateText(food ? "Hao hụt" : "Định lượng")}</th>
                  <th>{translateText("Dị nguyên")}</th>
                  <th>{translateText("Thao tác")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice((page - 1) * 12, page * 12).map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.name}</strong>
                      <small>{translateText(item.code || `#${item.id}`)}</small>
                    </td>
                    <td>{translateText(groupName(item))}</td>
                    <td>
                      {translateText(formatNumber(
                        !food && item.nutritionAvailable === false
                          ? null
                          : (item.energyKcal ??
                              item.energyKcal100g ??
                              item.nutrition?.energyKcal ??
                              item.totalCalories),
                      ))}{" "}{translateText("kcal")}</td>
                    <td>
                      {translateText(food
                        ? `${formatNumber(item.refuseRatePercent ?? item.refuse_rate_percent)} %`
                        : `${formatNumber(item.standardServingSizeG)} g`)}
                    </td>
                    <td>
                      {allergyNames(item).length ? (
                        allergyNames(item).map((a, i) => (
                          <span className="kp-tag red" key={i}>
                            {translateText(a)}
                          </span>
                        ))
                      ) : (
                        <span className="kp-tag gray">{translateText("Chưa ghi nhận")}</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="kp-button"
                        aria-label={translateText(`Chi tiết ${item.name}`)}
                        onClick={() => setDetail(String(item.id))}
                      >
                        <Eye size={14} />{translateText("Chi tiết")}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} total={rows.length} onChange={setPage} />
        </>
      )}
      {detail && (
        <CatalogDetail
          key={`${kind}-${detail}`}
          kind={kind}
          id={detail}
          onClose={() => setDetail(null)}
        />
      )}
    </>
  );
}
