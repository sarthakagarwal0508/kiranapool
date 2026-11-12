# KiranaPool Backend — Security and Flow Update

## Findings in the supplied archive

1. Auth responses returned signed JWTs as a JSON `token` property, encouraging browser storage accessible to JavaScript.
2. Public signup accepted `shopkeeper`, `wholesaler` and `rider` without an invitation/approval boundary. A stranger could self-register into a privileged role.
3. Authentication had no brute-force throttling, the API had no general request throttling or common security headers, JSON request bodies had no explicit size cap, and CORS errors were not normalized.
4. `POST /auth/logout` did not exist and sessions had no server-side revocation mechanism.
5. A rider directory/detail endpoint exposed rider profiles across unrelated wholesalers; riders could also retrieve unrelated shop and warehouse details.
6. A wholesaler could try assigning any rider ID, even one already associated with another wholesaler. Rider assignment updated multiple documents in a sequence that could leave partial state if a later write failed.
7. Shop deletion hard-deleted the shop document, potentially breaking historical order relationships.
8. Order lifecycle changes did not retain an auditable status history; a stale concurrent update could overwrite a newer status.
9. List endpoints returned unbounded collections, and plan status query values were not validated.
10. Warehouse area normalization used an incorrectly escaped whitespace pattern, which could make equivalent area strings fail to match.
11. ML error details could be copied into API responses / forecast warnings / saved plan metadata.
12. `src/middleware/error.middleware.js`, `src/utils/asyncHandler.js`, `src/routes/demo.route.js` and `src/services/demo.service.js` were empty. The demo route/service were not mounted or needed by the current route inventory. The API already had an inline error handler; this update adds a real reusable error handler and helper.
13. `README.md` instructed developers to copy `.env.example`, but the supplied archive did not contain that file. The referenced Postman collection was also absent.

## Changes made

### Authentication and API security

- Login, signup and Google sign-in now set a signed JWT in an `HttpOnly` cookie. The JSON response no longer contains the JWT.
- Cookie-authenticated unsafe methods require a separate double-submit CSRF cookie/header (`kp_csrf` / `X-CSRF-Token`). `GET /api/auth/csrf` returns the CSRF value and sets the matching cookie; login/signup/Google responses also include the CSRF value. This is needed for the current cross-domain Vercel/Render setup, where frontend JavaScript cannot read an API-domain cookie. Bearer tokens remain supported for native/non-browser clients.
- Added logout and token-version revocation. Logout invalidates all tokens/sessions for that account.
- Public signup is limited to shopkeepers. Wholesaler and rider registrations require separate server-side invitation codes.
- Added authentication throttling (10 attempts / 15 minutes per IP), tighter limits for ML operations and forecast generation, and API throttling (300 requests / 15 minutes per IP; in-memory per process).
- Added common security response headers, exact-origin credentialed CORS, 1 MB JSON body limit, request IDs, no-store responses, and a centralized sanitized error handler.
- Server startup now validates the JWT secret and cookie transport settings, and waits for MongoDB before opening the HTTP port.
- Production CORS no longer implicitly allows localhost origins; only the exact configured frontend/API origins are accepted.
- JWT expiry is parsed consistently for both the signed token and cookie lifetime. ML proxy responses reject invalid/oversized JSON instead of returning raw upstream text.
- Demo seeding no longer contains a default password. It requires explicit opt-in, a unique `DEMO_SEED_PASSWORD` (16+ characters), and an additional override to run in production; passwords are not printed.
- Warehouse directory responses no longer include the owner's email address.

### Workflow and data integrity

- Rider listing and detail lookup are now limited to riders managed by the current wholesaler or riders not yet claimed by a wholesaler. The first successful assignment links the rider to that wholesaler.
- Rider assignment, unassignment and cancellation use compare-and-set plan updates and check bulk order writes to reduce concurrent/partial workflow corruption. Added `DELETE /api/plans/:id/assign-rider` to unassign before a route starts.
- Riders can only retrieve shop details for their currently assigned, active deliveries and warehouse details connected to their plans.
- Shop deletion is now a guarded deactivation; active orders block deactivation and historical orders remain intact.
- Added `statusHistory` to orders and append audit entries on creation, planning, status changes and plan cancellation.
- Status writes use compare-and-set semantics to reject concurrent stale updates.
- Added bounded pagination (`page`, `limit`, max 100, capped deep offsets) to shop, rider, warehouse, order and plan list endpoints. Existing `count` and `data` fields remain; `total`, `page`, `limit`, `pages` are added.
- Plan status filters are validated.
- Fixed warehouse service-area whitespace normalization.
- ML service errors are now represented by safe generic messages instead of forwarding raw upstream detail.

### Added feature

`GET /api/analytics/overview` returns role-scoped dashboard metrics:

- Shopkeeper: shop count, order count/value by status and completion rate.
- Wholesaler: order count/value by status, active plans, available managed riders, pooled cost and estimated savings.
- Rider: assigned order metrics, active plan count and latest stored availability/location metadata.

Optional `from` and `to` query parameters filter by order creation date.

## Deployment configuration

Copy `.env.example` and set values in Render / your local environment. Never upload `.env` to GitHub.

Required:

- `MONGODB_URI`
- `JWT_SECRET` (at least 32 random characters; rotate the old secret if it was ever committed or exposed)
- `FRONTEND_URL` with exact frontend origin(s)

For the current Vercel + Render cross-origin deployment set:

```env
NODE_ENV=production
COOKIE_SECURE=true
COOKIE_SAME_SITE=None
TRUST_PROXY=true
FRONTEND_URL=https://kiranapool-sigma.vercel.app
```

Set strong private values for `WHOLESALER_SIGNUP_INVITE_CODE` and `RIDER_SIGNUP_INVITE_CODE` if new accounts of those roles must be registered. Leave them unset to disable those public signup paths. Do not put invite codes in Vite `VITE_*` environment variables. Production CORS should list only the deployed frontend origin(s); localhost is automatically included only in non-production mode.

## Frontend change required for the new auth behavior

The backend no longer returns `response.token` by design. Keep the returned `csrfToken` in memory (it is not an authentication credential) and bootstrap it from `/api/auth/csrf` after a full page refresh. Update the frontend API client:

```js
let csrfToken = "";

export async function refreshCsrfToken(apiBaseUrl) {
  const response = await fetch(`${apiBaseUrl}/auth/csrf`, { credentials: "include" });
  if (!response.ok) throw new Error("Could not initialize secure session");
  const body = await response.json();
  csrfToken = body.csrfToken || "";
  return csrfToken;
}

export async function apiFetch(url, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers || {});
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    if (!csrfToken) throw new Error("Refresh the CSRF token before sending this request");
    headers.set("X-CSRF-Token", csrfToken);
  }
  return fetch(url, { ...options, method, headers, credentials: "include" });
}

// After login/signup, store response.csrfToken in memory. On a full page refresh,
// call refreshCsrfToken(API_BASE_URL) before sending any POST/PATCH/PUT/DELETE request.
```

Remove JWT reads/writes from localStorage/sessionStorage. Call `/api/auth/me` to restore the signed-in user after a page refresh. Call `/api/auth/logout` when signing out.

Note: browser third-party-cookie restrictions can affect cookies between different site domains such as `vercel.app` and `onrender.com`. A custom frontend/API domain under the same registrable domain is the most reliable long-term deployment arrangement. Verify actual cookies in Chrome and Safari after deploying.

## Important verification boundaries

- Automated tests do not connect to your live MongoDB Atlas or FastAPI service.
- This update does not prove the deployed Render environment has the new environment variables until you set them and redeploy.
- No live production penetration test has been performed.
- The in-memory rate limiter is suitable for a single process/demo deployment; use a shared Redis-backed limiter before horizontal scaling.
- No mapping provider was added, per the request to leave maps for a separate pass.
- Product-price validation still trusts submitted item prices because no trusted product catalogue/inventory model exists in this backend.
