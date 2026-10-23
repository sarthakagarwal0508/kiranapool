const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const app = require("../src/app");

test("health endpoint reports API and database state", async () => {
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/health`);
    const body = await response.json();
    const connected = mongoose.connection.readyState === 1;
    assert.equal(response.status, connected ? 200 : 503);
    assert.equal(body.success, connected);
    assert.equal(body.services.api, "running");
    assert.equal(body.services.database, connected ? "connected" : "disconnected");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
