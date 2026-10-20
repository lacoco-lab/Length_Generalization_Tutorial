export function tokenize(text) {
  const s = text.trim();
  if (!s) throw new Error("Enter at least one token.");
  const tokens = /^[()]+$/.test(s) ? [...s] : s.split(/\s+/);
  if (tokens.length > 128) throw new Error("Use at most 128 tokens.");
  return tokens;
}
export function validateEvaluations(data) {
  if (!data || data.schema_version !== 1 || !Array.isArray(data.runs))
    throw new Error("Expected schema_version: 1 and a runs array.");
  if (data.runs.length > 100) throw new Error("Import at most 100 runs.");
  const ids = new Set();
  for (const r of data.runs) {
    for (const key of [
      "id",
      "task",
      "model",
      "positional_encoding",
      "checkpoint",
      "evaluated_at",
      "source",
    ]) {
      if (typeof r[key] !== "string" || !r[key].trim())
        throw new Error(`Each run needs a nonempty ${key}.`);
    }
    if (ids.has(r.id)) throw new Error(`Duplicate run id: ${r.id}`);
    ids.add(r.id);
    if (!Number.isInteger(r.seed) || r.seed < 0)
      throw new Error("seed must be a nonnegative integer.");
    if (r.metric !== "sequence_accuracy")
      throw new Error(
        "Only sequence_accuracy is supported; do not mix token and sequence accuracy.",
      );
    if (!Number.isSafeInteger(r.train_max_length) || r.train_max_length < 1)
      throw new Error("train_max_length must be a positive integer.");
    if (
      r.selection_max_length !== undefined &&
      (!Number.isSafeInteger(r.selection_max_length) || r.selection_max_length < r.train_max_length)
    )
      throw new Error("selection_max_length must be at least train_max_length.");
    if (!Number.isFinite(Date.parse(r.evaluated_at)))
      throw new Error("evaluated_at must be a valid timestamp.");
    if (!Array.isArray(r.points) || !r.points.length || r.points.length > 10000)
      throw new Error("Each run needs 1–10,000 evaluation points.");
    const lengths = new Set();
    for (const p of r.points) {
      if (!Number.isSafeInteger(p.length) || p.length < 1 || lengths.has(p.length))
        throw new Error("Evaluation lengths must be unique positive integers.");
      lengths.add(p.length);
      if (
        !Number.isSafeInteger(p.total) ||
        p.total < 1 ||
        !Number.isSafeInteger(p.correct) ||
        p.correct < 0 ||
        p.correct > p.total
      )
        throw new Error("Each point needs integer counts with 0 ≤ correct ≤ total and total > 0.");
    }
  }
  return data;
}
