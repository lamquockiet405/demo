import { EntityManager } from "typeorm";

// Operational state uses the existing configuration table; never seed demo records.
export async function readState<T>(
  manager: EntityManager | undefined | null,
  key: string,
  empty: T,
): Promise<T> {
  if (!manager || typeof manager.query !== "function") return empty;
  const rows = await manager.query(
    "SELECT config_value FROM system_configs WHERE config_key = $1",
    [key],
  );
  if (!rows[0]?.config_value) return empty;
  return JSON.parse(rows[0].config_value);
}

export async function writeState(
  manager: EntityManager | undefined | null,
  key: string,
  value: unknown,
) {
  if (!manager || typeof manager.transaction !== "function") return;
  await manager.transaction(async (transaction) => {
    await transaction.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      key,
    ]);
    const updated = await transaction.query(
      "UPDATE system_configs SET config_value=$2 WHERE config_key=$1 RETURNING id",
      [key, JSON.stringify(value)],
    );
    // PostgreSQL UPDATE may return [rows, affected], including [[], 0].
    const rows = Array.isArray(updated?.[0]) ? updated[0] : updated;
    if (!rows.length) {
      await transaction.query(
        "INSERT INTO system_configs (config_key, config_value) VALUES ($1, $2)",
        [key, JSON.stringify(value)],
      );
    }
  });
}

export const schoolDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const percent = (part: number, total: number) =>
  total > 0 ? Math.round((part / total) * 1000) / 10 : null;
