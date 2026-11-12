const test = require("node:test");
const assert = require("node:assert/strict");
const { parsePagination } = require("../src/utils/pagination");

test("pagination applies safe defaults and bounded limits", () => {
  assert.deepEqual(parsePagination({}), { page: 1, limit: 50, skip: 0 });
  assert.deepEqual(parsePagination({ page: "3", limit: "100" }), { page: 3, limit: 100, skip: 200 });
  assert.match(parsePagination({ limit: "1000" }).error, /limit/);
  assert.match(parsePagination({ page: "0" }).error, /page/);
});


test("pagination rejects excessively deep offsets", () => {
  const { parsePagination } = require("../src/utils/pagination");
  assert.match(parsePagination({ page: "100000", limit: "100" }).error, /too large/i);
});
