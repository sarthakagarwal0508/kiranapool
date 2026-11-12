const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("../src/app");
const User = require("../src/models/User");

const withServer = async (callback) => {
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  try { await callback(`http://127.0.0.1:${server.address().port}/api`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
};

test("privileged roles cannot self-register without a backend invitation code", async () => {
  const originalWholesalerCode = process.env.WHOLESALER_SIGNUP_INVITE_CODE;
  delete process.env.WHOLESALER_SIGNUP_INVITE_CODE;
  try {
    await withServer(async (base) => {
      const response = await fetch(`${base}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Untrusted", email: "untrusted@example.com", password: "Password123!", role: "wholesaler" }),
      });
      assert.equal(response.status, 403);
      const body = await response.json();
      assert.equal(body.success, false);
      assert.equal(Object.hasOwn(body, "token"), false);
    });
  } finally {
    if (originalWholesalerCode === undefined) delete process.env.WHOLESALER_SIGNUP_INVITE_CODE;
    else process.env.WHOLESALER_SIGNUP_INVITE_CODE = originalWholesalerCode;
  }
});

test("successful browser signup sets an HttpOnly JWT cookie and never returns the JWT in JSON", async () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalFindOne = User.findOne;
  const originalCreate = User.create;
  process.env.JWT_SECRET = "test-secret-which-is-long-enough-for-hs256-0123456789";
  User.findOne = async () => null;
  User.create = async (fields) => ({
    ...fields,
    _id: { toString: () => "64b000000000000000000001" },
    tokenVersion: 0,
  });

  try {
    await withServer(async (base) => {
      const response = await fetch(`${base}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Aman", email: "aman@example.com", password: "Password123!", role: "shopkeeper", tokenVersion: 500 }),
      });
      assert.equal(response.status, 201);
      const body = await response.json();
      assert.equal(body.success, true);
      assert.equal(body.user.role, "shopkeeper");
      assert.equal(typeof body.csrfToken, "string");
      assert.equal(body.csrfToken.length >= 40, true);
      assert.equal(Object.hasOwn(body, "token"), false);
      assert.equal(JSON.stringify(body).includes("eyJ"), false);

      const cookies = response.headers.getSetCookie();
      const authCookie = cookies.find((cookie) => cookie.startsWith("kp_access="));
      const csrfCookie = cookies.find((cookie) => cookie.startsWith("kp_csrf="));
      assert.ok(authCookie, "JWT cookie should be set");
      assert.match(authCookie, /HttpOnly/i);
      assert.ok(csrfCookie, "CSRF cookie should be set separately");
      assert.doesNotMatch(csrfCookie, /HttpOnly/i);
      assert.equal(decodeURIComponent(csrfCookie.split(";")[0].split("=").slice(1).join("=")), body.csrfToken);
      assert.equal(body.user.tokenVersion, undefined);
    });
  } finally {
    User.findOne = originalFindOne;
    User.create = originalCreate;
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  }
});

test("cookie-authenticated state-changing requests are rejected without the CSRF header", async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: "kp_access=not-a-real-jwt; kp_csrf=test-csrf" },
      body: "{}",
    });
    assert.equal(response.status, 403);
    const body = await response.json();
    assert.match(body.message, /CSRF/i);
  });
});


test("CSRF bootstrap endpoint returns a readable token while setting its matching cookie", async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/auth/csrf`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(typeof body.csrfToken, "string");
    const csrfCookie = response.headers.getSetCookie().find((cookie) => cookie.startsWith("kp_csrf="));
    assert.ok(csrfCookie);
    assert.equal(decodeURIComponent(csrfCookie.split(";")[0].slice("kp_csrf=".length)), body.csrfToken);
    assert.equal(Object.hasOwn(body, "token"), false);
  });
});

test("cookie-authenticated requests pass the CSRF gate when the token header matches", async () => {
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "test-secret-which-is-long-enough-for-hs256-0123456789";
  try {
    await withServer(async (base) => {
      const response = await fetch(`${base}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: "kp_access=not-a-real-jwt; kp_csrf=test-csrf",
          "X-CSRF-Token": "test-csrf",
        },
        body: "{}",
      });
      // CSRF passed; authentication then correctly rejects the fake JWT.
      assert.equal(response.status, 401);
      const body = await response.json();
      assert.match(body.message, /session|authentication|invalid/i);
    });
  } finally {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  }
});
