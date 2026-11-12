const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

test("demo seeder refuses to run unless explicit opt-in is enabled", () => {
  const seedPath = path.join(__dirname, "..", "src", "seed", "seedDemo.js");
  const result = spawnSync(process.execPath, [seedPath], {
    encoding: "utf8",
    timeout: 5000,
    env: {
      ...process.env,
      ALLOW_DEMO_SEED: "false",
      ALLOW_DEMO_SEED_IN_PRODUCTION: "false",
      NODE_ENV: "test",
      DEMO_SEED_PASSWORD: "",
      MONGODB_URI: "",
    },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Demo seeding is disabled/i);
});
