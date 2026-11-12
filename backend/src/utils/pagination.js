function parsePagination(query = {}, { defaultLimit = 50, maxLimit = 100, maxSkip = 100_000 } = {}) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? defaultLimit : Number(query.limit);
  if (!Number.isSafeInteger(page) || page < 1) return { error: "page must be a positive safe integer" };
  if (!Number.isInteger(limit) || limit < 1 || limit > maxLimit) return { error: `limit must be an integer from 1 to ${maxLimit}` };
  const skip = (page - 1) * limit;
  if (!Number.isSafeInteger(skip) || skip > maxSkip) return { error: `page is too large; use a page with at most ${maxSkip} skipped records` };
  return { page, limit, skip };
}
module.exports = { parsePagination };
