# KiranaPool Backend API Docs — Auth + Shops

Scope: authentication and Shops APIs implemented so far.

- Local API base URL: `http://localhost:5000/api`
- Content-Type: `application/json`
- Protected routes: `Authorization: Bearer <KIRANAPOOL_JWT>`
- Roles: `shopkeeper`, `rider`

## Current status
- Health endpoint: existing and tested.
- Signup, login, `/auth/me`, invalid token and duplicate signup: reported tested successfully.
- Google auth endpoint: code present; real Google Sign-In token flow still needs a live test.
- Shops CRUD: updated to use JWT identity and enforce ownership; reported working.

Included: `API.md`, `SCHEMAS.md`, `openapi.yaml`, `postman_collection.json`, `postman_environment.json`.

This contract reflects the implementation discussed in chat. If local code differs, the running backend is the source of truth. Never expose MongoDB credentials or JWT secret in frontend code.
