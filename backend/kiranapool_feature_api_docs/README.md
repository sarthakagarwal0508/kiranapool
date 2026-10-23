# KiranaPool — Feature-wise API Documentation

Base URL: `http://localhost:5000/api`

These files split the APIs implemented across the first five phases into separate feature documents.

## Files
- `01-health-api.md` — Health check
- `02-auth-apis.md` — Signup, login, Google auth, current user
- `03-shops-apis.md` — Shop CRUD
- `04-riders-apis.md` — Rider profile and directory
- `05-orders-apis.md` — Order creation, listing, details, status
- `API-INVENTORY.md` — Complete endpoint checklist and count

## Current endpoint inventory
**19 endpoints** across five feature groups:
- Health: 1
- Authentication: 4
- Shops: 5
- Riders: 5
- Orders: 4

All protected endpoints use:
`Authorization: Bearer <JWT_TOKEN>`

Roles implemented: `shopkeeper`, `rider`.

Notes:
- This reflects the implementation described in the project conversation. Google OAuth endpoint exists, but a real Google ID-token sign-in flow still needs live verification.
- Delivery planning/pooling endpoints are not included because Phase 6 has not started.
- Replace example MongoDB ObjectIds and credentials with your own test data.
