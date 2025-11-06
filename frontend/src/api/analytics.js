import api, { unwrap } from "./client";

/** POST /api/analytics/query/nl */
export function askQuestion(dataset, question, { row_limit = 200, preview = false } = {}) {
  // adapte la charge utile à ton backend si besoin
  return unwrap(api.post("/analytics/query/nl", {
    dataset,
    question,
    row_limit,
    preview,
  }));
}

/** POST /api/analytics/query/sql */
export function runQuery(sql, { row_limit = 200 } = {}) {
  return unwrap(api.post("/analytics/query/sql", { sql, row_limit }));
}
