import React, { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { apiClient } from "../../../core/api/axios";
import { useAuthStore } from "../../../core/stores/auth.store";
import { getInspectionMenuDishes } from "../api/kitchen.api";
import { inspectionDishNames } from "../utils/inspection-menu";
import {
  Modal,
  Notice,
  useKitchenAction,
  useKitchenResource,
} from "./KitchenUI";

export function CreateKitchenInspectionModal({
  initialDate,
  onClose,
  onCreated,
}: {
  initialDate: string;
  onClose: () => void;
  onCreated: (id: string | null) => Promise<void>;
}) {
  const { user } = useAuthStore();
  const [form, setForm] = useState({
    mealDate: initialDate,
    mealSession: "LUNCH",
    note: "",
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [additional, setAdditional] = useState("");
  const [showAdditional, setShowAdditional] = useState(false);
  const action = useKitchenAction();
  const menu = useKitchenResource(
    async () => ({
      date: form.mealDate,
      mealSession: form.mealSession,
      dishes: await getInspectionMenuDishes(form.mealDate, form.mealSession),
    }),
    [form.mealDate, form.mealSession],
  );
  const ready =
    menu.data?.date === form.mealDate &&
    menu.data?.mealSession === form.mealSession;
  const choices = ready && !menu.error ? menu.data.dishes : [];
  useEffect(() => {
    if (ready) setSelected(menu.data.dishes.map((dish) => dish.id));
  }, [menu.data, ready]);
  const names = inspectionDishNames(
    choices.filter((dish) => selected.includes(dish.id)),
    additional,
  );
  const changeServing = (change: Partial<typeof form>) => {
    setSelected([]);
    setAdditional("");
    setShowAdditional(false);
    setForm((previous) => ({ ...previous, ...change }));
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    await action.run(async () => {
      if (menu.loading)
        throw new Error("Chờ tải xong thực đơn trước khi tạo biên bản.");
      if (!names.length)
        throw new Error(
          "Chọn ít nhất một món kiểm thực hoặc nhập món bổ sung.",
        );
      const result = (
        await apiClient.post("/inspections/create-session", {
          mealDate: form.mealDate,
          mealSession: form.mealSession,
          note: form.note.trim(),
          dishes: names,
          nutritionistName: user?.fullName,
        })
      ).data;
      await onCreated(
        result.recordId || result.code
          ? String(result.recordId || result.code)
          : null,
      );
    });
  };
  return (
    <Modal title="Tạo biên bản kiểm thực" busy={action.busy} onClose={onClose}>
      <Notice error={action.error} />
      <form onSubmit={save}>
        <div className="kp-form-grid">
          <label className="kp-field">
            Ngày kiểm thực
            <input
              className="kp-input"
              type="date"
              required
              disabled={action.busy}
              value={form.mealDate}
              onChange={(event) => {
                if (event.target.value)
                  changeServing({ mealDate: event.target.value });
              }}
            />
          </label>
          <label className="kp-field">
            Bữa ăn
            <select
              className="kp-input"
              aria-label="Bữa ăn kiểm thực"
              disabled={action.busy}
              value={form.mealSession}
              onChange={(event) =>
                changeServing({ mealSession: event.target.value })
              }
            >
              <option value="BREAKFAST">Bữa sáng</option>
              <option value="LUNCH">Bữa trưa</option>
              <option value="AFTERNOON_SNACK">Bữa phụ xế</option>
            </select>
          </label>
          <fieldset
            className="kp-inspection-menu kp-field full"
            aria-busy={menu.loading}
          >
            <legend>Các món kiểm thực theo thực đơn</legend>
            <div className="kp-inspection-menu-heading">
              <p>
                Tự lấy món từ thực đơn đã duyệt đúng ngày và bữa ăn đã chọn.
              </p>
              <button
                type="button"
                className="kp-button"
                disabled={menu.loading || action.busy}
                onClick={() => void menu.reload()}
              >
                <RefreshCw
                  size={13}
                  className={menu.loading ? "animate-spin" : ""}
                />
                Tải lại thực đơn
              </button>
            </div>
            {menu.loading ? (
              <p className="kp-inspection-menu-state" role="status">
                Đang lấy món ăn từ thực đơn…
              </p>
            ) : menu.error ? (
              <Notice error={menu.error} />
            ) : !choices.length ? (
              <p className="kp-inspection-menu-state">
                Chưa có món trong thực đơn đã duyệt cho ngày và bữa ăn này. Bạn
                có thể nhập món bổ sung bên dưới.
              </p>
            ) : (
              <>
                <div className="kp-inspection-menu-selection">
                  <span>
                    Đã chọn{" "}
                    {
                      choices.filter((dish) => selected.includes(dish.id))
                        .length
                    }
                    /{choices.length} món
                  </span>
                  <div>
                    <button
                      type="button"
                      disabled={action.busy}
                      onClick={() =>
                        setSelected(choices.map((dish) => dish.id))
                      }
                    >
                      Chọn tất cả
                    </button>
                    <button
                      type="button"
                      disabled={action.busy}
                      onClick={() => setSelected([])}
                    >
                      Bỏ chọn
                    </button>
                  </div>
                </div>
                <div className="kp-inspection-menu-options">
                  {choices.map((dish) => (
                    <label key={dish.id}>
                      <input
                        type="checkbox"
                        aria-label={`Kiểm thực ${dish.name}`}
                        disabled={action.busy}
                        checked={selected.includes(dish.id)}
                        onChange={(event) =>
                          setSelected((previous) =>
                            event.target.checked
                              ? [...previous, dish.id]
                              : previous.filter((id) => id !== dish.id),
                          )
                        }
                      />
                      <span>
                        <strong>{dish.name}</strong>
                        <small>{dish.menus.join(" · ")}</small>
                      </span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </fieldset>
          <div className="kp-field full">
            <button
              type="button"
              className="kp-inspection-additional"
              aria-expanded={showAdditional}
              aria-controls="inspection-additional-dishes"
              disabled={action.busy}
              onClick={() => setShowAdditional((previous) => !previous)}
            >
              {showAdditional
                ? "Ẩn phần nhập món bổ sung"
                : "+ Nhập món bổ sung ngoài thực đơn"}
            </button>
            {showAdditional && (
              <label className="kp-field">
                Món bổ sung (mỗi dòng một món)
                <textarea
                  id="inspection-additional-dishes"
                  className="kp-input"
                  maxLength={2000}
                  disabled={action.busy}
                  value={additional}
                  onChange={(event) => setAdditional(event.target.value)}
                />
              </label>
            )}
          </div>
          <label className="kp-field full">
            Ghi chú ban đầu
            <textarea
              className="kp-input"
              maxLength={2000}
              disabled={action.busy}
              value={form.note}
              onChange={(event) =>
                setForm({ ...form, note: event.target.value })
              }
            />
          </label>
        </div>
        <div className="kp-form-actions kp-inspection-form-actions">
          <span className="kp-inspection-menu-total">
            {names.length} món kiểm thực
          </span>
          <button
            className="kp-button primary"
            disabled={action.busy || menu.loading || !names.length}
          >
            {action.busy ? "Đang tạo…" : "Tạo và bổ sung 3 bước"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
