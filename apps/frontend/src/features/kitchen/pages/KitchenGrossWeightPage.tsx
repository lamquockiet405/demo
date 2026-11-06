import { t as translateText } from '../../../core/i18n/language';
import { useLanguage } from '../../../core/i18n/useLanguage';
import React, { useState } from "react";
import { Calculator, Download, Plus, Trash2 } from "lucide-react";
import { apiClient } from "../../../core/api/axios";
import { fetchKitchenCollection } from "../api/kitchen.api";
import {
  calculateGrossWeight,
  downloadCsv,
  formatNumber,
  rowsOf,
} from "../utils/kitchen-operations";
import { getSchoolDate, normalizeSearch } from "../utils/kds-data";
import {
  Notice,
  PageTitle,
  ResourceState,
  useKitchenAction,
  useKitchenResource,
} from "../components/KitchenUI";

type IngredientLine = {
  key: string;
  foodId: string;
  name: string;
  net: string;
  refuse: string;
};
const line = (): IngredientLine => ({
  key: crypto.randomUUID(),
  foodId: "",
  name: "",
  net: "",
  refuse: "",
});
export function KitchenGrossWeightPage({
  audience = "kitchen",
}: {
  audience?: "kitchen" | "nutritionist";
}) {
  useLanguage();
  const resource = useKitchenResource(async () => {
    const results = await Promise.allSettled([
      fetchKitchenCollection("/foods"),
      fetchKitchenCollection("/dishes"),
    ]);
    for (const result of results)
      if (result.status === "rejected") throw result.reason;
    return {
      foods: (results[0] as PromiseFulfilledResult<any[]>).value,
      dishes: (results[1] as PromiseFulfilledResult<any[]>).value,
    };
  }, []);
  const action = useKitchenAction();
  const [date, setDate] = useState(getSchoolDate);
  const [portions, setPortions] = useState("100");
  const [dishId, setDishId] = useState("");
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<IngredientLine[]>([line()]);
  const update = (key: string, change: Partial<IngredientLine>) =>
    setLines((previous) =>
      previous.map((row) => (row.key === key ? { ...row, ...change } : row)),
    );
  const chooseFood = (row: IngredientLine, id: string) => {
    const food = resource.data?.foods.find((f) => String(f.id) === id);
    update(row.key, {
      foodId: id,
      name: food?.name || "",
      refuse:
        food?.refuseRatePercent == null && food?.refuse_rate_percent == null
          ? ""
          : String(food.refuseRatePercent ?? food.refuse_rate_percent),
    });
  };
  const importRecipe = async () => {
    await action.run(async () => {
      if (!dishId) throw new Error("Chọn món ăn cần lấy công thức.");
      const dish = (await apiClient.get(`/dishes/${dishId}`)).data;
      const recipe = rowsOf(
        dish.recipeItems?.length ? dish.recipeItems : dish.recipes,
      );
      if (!recipe.length)
        throw new Error(
          "Món chưa có công thức định lượng. Thêm nguyên liệu và nhập định lượng để tính.",
        );
      const next = recipe.map((item) => {
        const id = String(item.foodId ?? item.ingredientId ?? "");
        const food = resource.data?.foods.find((f) => String(f.id) === id);
        return {
          key: crypto.randomUUID(),
          foodId: id,
          name:
            food?.name ||
            item.ingredientName ||
            item.food?.name ||
            "Nguyên liệu",
          net:
            item.netWeightPerPortionG == null && item.netWeightG == null
              ? ""
              : String(item.netWeightPerPortionG ?? item.netWeightG),
          refuse:
            food?.refuseRatePercent == null && food?.refuse_rate_percent == null
              ? ""
              : String(food.refuseRatePercent ?? food.refuse_rate_percent),
        };
      });
      setLines(next);
    }, "Đã lấy công thức. Kiểm tra định lượng, hao hụt và số suất trước khi xuất.");
  };
  const result = lines.map((row) => {
    try {
      if (
        !row.name ||
        !row.net.trim() ||
        !row.refuse.trim() ||
        !portions.trim()
      )
        return null;
      return calculateGrossWeight(
        Number(row.net),
        Number(portions),
        Number(row.refuse),
      );
    } catch {
      return null;
    }
  });
  const valid = lines.length > 0 && result.every(Boolean);
  const dishes =
    resource.data?.dishes.filter((d) =>
      normalizeSearch(d.name).includes(normalizeSearch(search)),
    ) || [];
  const total = valid ? result.reduce((sum, r) => sum + r!.grossKg, 0) : null;
  return (
    <>
      <PageTitle
        eyebrow={
          translateText(audience === "nutritionist" ? "CHUYÊN GIA DINH DƯỠNG" : undefined)
        }
        title={translateText("Dự trù nguyên liệu cần mua")}
        description={translateText("Tính khối lượng mua từ định lượng tinh mỗi suất, số suất và hao hụt sơ chế. Có thể lấy định lượng từ công thức món ăn.")}
      >
        <button
          className="kp-button primary"
          disabled={!valid}
          onClick={() =>
            downloadCsv(`du-tru-nguyen-lieu-${date}.csv`, [
              [
                "Ngày",
                "Nguyên liệu",
                "Số suất",
                "Tinh / suất (g)",
                "Hao hụt (%)",
                "Tổng tinh (g)",
                "Mua thô (g)",
                "Mua thô (kg)",
              ],
              ...lines.map((r, i) => [
                date,
                r.name,
                portions,
                r.net,
                r.refuse,
                result[i]?.netGrams,
                result[i]?.grossGrams,
                result[i]?.grossKg,
              ]),
            ])
          }
        >
          <Download size={15} />{translateText("Xuất dự trù")}</button>
      </PageTitle>
      <ResourceState resource={resource} />
      <Notice error={action.error} message={action.message} />
      <section className="kp-panel">
        <h2>
          <Calculator size={18} className="inline mr-2" />{translateText("Thông số tính")}</h2>
        <div className="kp-form-grid">
          <label className="kp-field">{translateText("Ngày phục vụ")}<input
              className="kp-input"
              required
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="kp-field">{translateText("Số suất")}<input
              className="kp-input"
              aria-label={translateText("Số suất dự trù")}
              type="number"
              min={0}
              step={1}
              value={portions}
              onChange={(e) => setPortions(e.target.value)}
            />
          </label>
          <label className="kp-field">{translateText("Tìm món có công thức")}<input
              className="kp-input"
              type="search"
              aria-label={translateText("Tìm món lấy công thức")}
              value={search}
              placeholder={translateText("Tìm tên món…")}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="kp-field">{translateText("Món ăn")}<select
              className="kp-input"
              aria-label={translateText("Món lấy công thức")}
              value={dishId}
              onChange={(e) => setDishId(e.target.value)}
            >
              <option value="">{translateText("Chọn món")}</option>
              {dishes.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="kp-form-actions">
          <button
            className="kp-button"
            disabled={!dishId || action.busy}
            onClick={() => void importRecipe()}
          >{translateText("Lấy định lượng công thức")}</button>
        </div>
        <p>{translateText("Khối lượng mua thô = (định lượng tinh mỗi suất × số suất) ÷ (1 − tỷ lệ hao hụt / 100). Hao hụt cần từ 0 đến dưới 100%.")}</p>
      </section>
      <div className="kp-table-wrap">
        <table className="kp-table">
          <thead>
            <tr>
              <th>{translateText("Nguyên liệu")}</th>
              <th>{translateText("Tinh / suất (g)")}</th>
              <th>{translateText("Hao hụt (%)")}</th>
              <th>{translateText("Tổng tinh (g)")}</th>
              <th>{translateText("Đề xuất mua (kg)")}</th>
              <th>{translateText("Xóa")}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((row, index) => (
              <tr key={row.key}>
                <td>
                  <select
                    className="kp-input"
                    style={{ maxWidth: 280 }}
                    aria-label={translateText(`Nguyên liệu dòng ${index + 1}`)}
                    value={row.foodId}
                    onChange={(e) => chooseFood(row, e.target.value)}
                  >
                    <option value="">{translateText("Chọn nguyên liệu")}</option>
                    {resource.data?.foods.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                  {row.name && <small>{row.name}</small>}
                </td>
                <td>
                  <input
                    className="kp-input"
                    type="number"
                    min={0}
                    step="any"
                    aria-label={translateText(`Định lượng dòng ${index + 1}`)}
                    value={row.net}
                    onChange={(e) => update(row.key, { net: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="kp-input"
                    type="number"
                    min={0}
                    max={99.99}
                    step="any"
                    aria-label={translateText(`Hao hụt dòng ${index + 1}`)}
                    value={row.refuse}
                    onChange={(e) =>
                      update(row.key, { refuse: e.target.value })
                    }
                  />
                </td>
                <td>{translateText(formatNumber(result[index]?.netGrams, 2))}</td>
                <td>
                  <strong>{translateText(formatNumber(result[index]?.grossKg, 3))}</strong>
                </td>
                <td>
                  <button
                    className="kp-button icon danger"
                    aria-label={translateText(`Xóa nguyên liệu dòng ${index + 1}`)}
                    onClick={() =>
                      setLines(lines.filter((r) => r.key !== row.key))
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="kp-pager">
        <button
          className="kp-button"
          onClick={() => setLines([...lines, line()])}
        >
          <Plus size={15} />{translateText("Thêm nguyên liệu")}</button>
        <span style={{ marginLeft: "auto", marginRight: 0 }}>{translateText("Tổng khối lượng đề xuất:")}{" "}
          <b className="text-emerald-700 text-lg">
            {translateText(formatNumber(total, 3))}{translateText(" kg")}</b>
        </span>
      </div>
      {!valid && (
        <p className="text-xs text-amber-800">{translateText("Điền đủ nguyên liệu, định lượng và tỷ lệ hao hụt hợp lệ để xuất dự trù.")}</p>
      )}
    </>
  );
}
