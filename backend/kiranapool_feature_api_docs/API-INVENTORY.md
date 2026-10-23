# KiranaPool API Inventory — Phases 1–5

Base URL: `http://localhost:5000/api`

| # | Feature | Method | Endpoint | Auth / access |
|---:|---|---|---|---|
| 1 | Health | GET | `/health` | Public |
| 2 | Auth | POST | `/auth/signup` | Public |
| 3 | Auth | POST | `/auth/login` | Public |
| 4 | Auth | POST | `/auth/google` | Public |
| 5 | Auth | GET | `/auth/me` | JWT |
| 6 | Shops | GET | `/shops` | JWT |
| 7 | Shops | GET | `/shops/:id` | JWT |
| 8 | Shops | POST | `/shops` | Shopkeeper |
| 9 | Shops | PATCH | `/shops/:id` | Owning shopkeeper |
| 10 | Shops | DELETE | `/shops/:id` | Owning shopkeeper |
| 11 | Riders | GET | `/riders` | JWT |
| 12 | Riders | GET | `/riders/:id` | JWT |
| 13 | Riders | POST | `/riders` | Rider |
| 14 | Riders | GET | `/riders/me` | Rider |
| 15 | Riders | PATCH | `/riders/me` | Rider |
| 16 | Orders | POST | `/orders` | Shopkeeper |
| 17 | Orders | GET | `/orders` | JWT; role-filtered |
| 18 | Orders | GET | `/orders/:id` | JWT; ownership/assignment |
| 19 | Orders | PATCH | `/orders/:id/status` | Shopkeeper/rider with restrictions |

**Total documented endpoints: 19**
- Health: 1
- Auth: 4
- Shops: 5
- Riders: 5
- Orders: 4

## Implemented but not counted as extra endpoints
- JWT `protect` and `allowRoles` are middleware, not endpoints.
- MongoDB models (`User`, `Shop`, `Rider`, `Order`, `Plan`, `Forecast`) are data schemas, not endpoints.

## Not yet included
- Delivery planning: `POST /plan`, `GET /plan/latest`
- Forecast API
- Demo reset/start APIs
- Retailer marketplace/catalogue APIs (not implemented in current five phases)
