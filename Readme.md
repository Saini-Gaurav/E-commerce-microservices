# E-Commerce Microservices — Backend

A Node.js/TypeScript/PostgreSQL microservices backend, migrated from an original
Express/MongoDB monolith, built as a learning project with production-grade patterns:
database-per-service, RS256 JWT auth, claims-based RBAC, and an event-driven
saga implemented over Kafka.

## Architecture at a glance

```
                     ┌──────────────┐
                     │ auth-service │  issues RS256 JWTs (cookie), owns users + permissions
                     │   :4001      │
                     └──────┬───────┘
                            │ public.pem distributed to every other service
        ┌───────────────────┼───────────────────┬─────────────────────┐
        ▼                   ▼                   ▼                     ▼
┌───────────────┐  ┌────────────────┐  ┌────────────────┐  ┌──────────────────┐
│ product-service│  │  cart-service  │  │  order-service  │  │  payment-service │
│    :4002       │  │    :4003       │  │    :4004        │  │    :4005         │
└───────┬────────┘  └────────┬───────┘  └────────┬────────┘  └────────┬─────────┘
        │                    │                    │                    │
        │  product-events    │  product-events    │  order-events      │  order-events
        │  (produce)         │  (consume: cache)  │  (produce+consume) │  (consume: cache)
        │                    │                    │                    │
        └───────────►────────┴────────►───────────┴──────────►─────────┘
                          Kafka (single broker, KRaft mode, local dev)
```

**No service ever calls another service's REST API to read data it needs repeatedly.**
Every cross-service data need (product price for a cart, order total for a payment) is
solved by **listening to Kafka and keeping a small local cache**, not by a live HTTP
call. The only place a direct, synchronous dependency exists between services is
verifying a JWT — and that's math (a cryptographic signature check), not a network call.

## Services — summary

| Service | Port | Own database | Responsibility |
|---|---|---|---|
| **auth-service** | 4001 | `auth_service_db` | Register/login, RS256 JWT issuing + refresh token rotation (with theft detection), owns `users` + `permissions` |
| **product-service** | 4002 | `product_service_db` | Products + categories CRUD, publishes `product-events`, consumes `order-events` to decrement stock |
| **cart-service** | 4003 | `cart_service_db` | Per-user cart (ownership-based auth, no RBAC), consumes `product-events` into local cache |
| **order-service** | 4004 | `order_service_db` | Places orders, snapshots price at order time, publishes `order-events`, consumes `payment-events` |
| **payment-service** | 4005 | `payment_service_db` | Razorpay checkout (sandbox) + webhook fallback, consumes `order-events` so payment amount is never trusted from the client |

## Why these specific design decisions

**Database-per-service, no shared database.** Each service owns its data exclusively;
nothing else queries it directly. The cost: no cross-service SQL `JOIN`s — every
cross-service data need is solved via Kafka-fed local caches instead.

**Raw SQL (`pg`), no ORM.** Chosen deliberately to build real SQL fluency —
parameterized queries only, a hand-rolled migration runner (`schema_migrations`
tracking table), explicit indexes on every foreign-key-shaped column (Postgres does
**not** auto-index these — this bit us for real on `products.category_id`).

**RS256 (asymmetric) JWTs, not HS256 (shared secret).** auth-service alone holds
`private.pem` and signs tokens. Every other service holds only `public.pem` and can
verify a signature but never forge one — a compromised downstream service can't mint
fake admin tokens, unlike a shared-secret setup.

**RBAC via JWT claims, not a per-service database lookup.** `roleCode` and a flat
`permissions: string[]` array are embedded directly in the access token at login. No
service needs its own `permissions` table or a live call back to auth-service to
authorize a request. Trade-off: a permission change only takes effect on the user's
next login/refresh, not instantly.

**Ownership-based auth vs. RBAC — used deliberately, not interchangeably.** Cart and
"view your own order/payment" use `requireAuth` only, scoped by `req.user.userId`.
Admin-wide actions use `requirePermission`. Order-service needs both on the same
resource (`GET /orders/:id` — owner OR admin).

**Kafka over RabbitMQ.** The core need is *state replication* — a new service instance
must be able to replay a topic's full history (`fromBeginning: true`) to build its cache
from scratch. Kafka retains messages after consumption to support exactly this;
RabbitMQ's default model deletes a message once consumed, fitting job queues better.

**Prices are snapshotted, never live-joined, once an action is final.** Cart shows
*live* price. Order and payment amounts are *frozen* at creation — this shows up in
`order_items.unit_price`, `payment.amount`, and payment-service's local `order_cache`,
which exists specifically so a payment amount is never trusted from the client.

---

## Endpoints by service

All routes are prefixed with `/api/v1`. `🔒` = requires `requireAuth` (valid login
cookie). `👑` = additionally requires a specific RBAC permission (noted). Unmarked
routes are public.

### auth-service — `http://localhost:4001`

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/auth/register` | public | Always creates a `CUSTOMER` — self-registration can never grant `ADMIN` |
| POST | `/auth/login` | public | Sets `access_token` + `refresh_token` httpOnly cookies |
| POST | `/auth/refresh` | public (needs refresh cookie) | Rotates refresh token; reuse of an old one revokes ALL sessions (theft detection) |
| POST | `/auth/logout` | public (needs refresh cookie) | Revokes just this session's refresh token |
| GET | `/auth/me` | 🔒 | Returns decoded token payload — useful sanity check |
| GET | `/rbac/permissions` | 🔒👑 `USER_MANAGE` | Lists the full role→permission catalog |

### product-service — `http://localhost:4002`

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/categories` | public | |
| GET | `/categories/:id` | public | |
| POST | `/categories` | 🔒👑 `CATEGORY_MANAGE` | |
| PUT | `/categories/:id` | 🔒👑 `CATEGORY_MANAGE` | |
| DELETE | `/categories/:id` | 🔒👑 `CATEGORY_MANAGE` | `409` if any product still references it |
| GET | `/products` | public | Query: `page`, `limit`, `categoryId`, `isFeatured`, `search` |
| GET | `/products/:id` | public | |
| POST | `/products` | 🔒👑 `PRODUCT_CREATE` | Publishes `PRODUCT_UPSERTED` |
| PUT | `/products/:id` | 🔒👑 `PRODUCT_UPDATE` | Publishes `PRODUCT_UPSERTED` |
| DELETE | `/products/:id` | 🔒👑 `PRODUCT_DELETE` | Publishes `PRODUCT_DELETED` |

### cart-service — `http://localhost:4003`

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/cart` | 🔒 | Auto-creates an empty cart on first access; enriches items via local `product_cache` |
| POST | `/cart/items` | 🔒 | `{ productId, quantity }` — adds, or increments if already present |
| PUT | `/cart/items/:productId` | 🔒 | Sets an *exact* quantity (not additive); rejects `0` (use DELETE instead) |
| DELETE | `/cart/items/:productId` | 🔒 | |
| DELETE | `/cart` | 🔒 | Clears everything |

No RBAC anywhere in this service — every route is ownership-scoped only.

### order-service — `http://localhost:4004`

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/orders` | 🔒 | `{ shippingAddress1, city, zip, country, phone, items[] }` — validates + snapshots price against local `product_cache`, publishes `ORDER_CREATED` |
| GET | `/orders/mine` | 🔒 | Paginated, own orders only |
| GET | `/orders/:id` | 🔒 | Owner OR `ORDER_READ_ANY` admin; returns `404` (not `403`) if neither, to avoid confirming the id exists |
| GET | `/orders` | 🔒👑 `ORDER_READ_ANY` | All orders, filterable by `status` |
| PUT | `/orders/:id/status` | 🔒👑 `ORDER_UPDATE_STATUS` | One of `PENDING/PROCESSING/SHIPPED/DELIVERED/CANCELLED` |

### payment-service — `http://localhost:4005`

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/payments/initiate` | 🔒 | `{ orderId }` only — amount is looked up from local `order_cache`, never accepted from the client |
| POST | `/payments/verify` | 🔒 | `{ razorpayOrderId, razorpayPaymentId, razorpaySignature }` — HMAC-verified; publishes `PAYMENT_COMPLETED` |
| GET | `/payments/order/:orderId` | 🔒 | Payment status for one order |
| POST | `/webhooks/razorpay` | public* | *Not user-authenticated — trust comes from HMAC signature verification against `RAZORPAY_WEBHOOK_SECRET`, since Razorpay's server (not a logged-in user) calls this directly |

---

## Event catalog

| Topic | Producer | Consumers | Payload |
|---|---|---|---|
| `product-events` | product-service | cart-service, order-service | `{ eventType: "PRODUCT_UPSERTED" \| "PRODUCT_DELETED", product / productId }` |
| `order-events` | order-service | product-service, payment-service | `{ eventType: "ORDER_CREATED", orderId, userId, items, totalPrice }` |
| `payment-events` | payment-service | order-service | `{ eventType: "PAYMENT_COMPLETED", orderId, paymentId, amount }` |

Every consumer group name is unique per service — this is what lets multiple
independent services each receive their own full copy of every message on a topic
(Kafka's consumer-group fan-out), rather than competing for the same messages the way a
traditional job queue would.

## Known gaps — deliberate, not oversights

- **No compensating action if stock decrement fails** after an order is already
  created (a real race under concurrent orders) — currently just logged loudly, not
  auto-resolved. A full saga would add a `STOCK_RESERVATION_FAILED` event for
  order-service to catch and cancel the order.
- **Poison-pill messages must be guarded against explicitly** — any consumer using
  `fromBeginning: true` will eventually replay old/malformed messages from earlier code
  versions (learned this directly when a pre-`totalPrice` message crashed
  payment-service's consumer in an infinite retry loop).
- **Cache eventual-consistency window** — a brand-new product/order might not yet be in
  a dependent service's local cache; currently surfaces as `400`, not a retry.
- **No frontend yet** — every service is verified via Postman + direct Kafka/DB
  inspection. Deliberately the next step, ahead of further backend hardening.

## Local setup

**Prerequisites:** Node 18+, PostgreSQL running locally, Docker (for Kafka), npm.

**1. Start Kafka:**
```bash
docker compose up -d kafka
```

**2. For each service** (`auth-services`, `product-services`, `cart-services`,
`order-services`, `payment-services`):
```bash
cd services/<service-name>
cp .env.example .env        # fill in real values
npm install
```

**3. Generate the RS256 key pair once, in `auth-services/`:**
```bash
mkdir -p keys
openssl genrsa -out keys/private.pem 2048
openssl rsa -in keys/private.pem -pubout -out keys/public.pem
```
Copy `public.pem` into every other service's own `keys/` folder. `private.pem` never
leaves auth-service.

**4. Create each service's database, then run migrations:**
```bash
psql -U postgres -c "CREATE DATABASE auth_service_db;"     # repeat per service
cd services/<service-name> && npm run migrate:dev
```

**5. Seed test data:**
```bash
cd services/auth-services && npm run seed
cd services/product-services && npm run seed
```

**6. Install root development dependencies:**

From the project root:

```bash
npm install
```
auth-service → product-service → cart-service → order-service → payment-service
```

**7. Add RBAC permissions for order-service** (not covered by the seed script) —
`ORDER_READ_ANY` and `ORDER_UPDATE_STATUS` granted to `ADMIN`, in auth-service's
`permissions` table.

**8. Razorpay sandbox:** Test Mode API keys go in `payment-services/.env`. For webhook
testing, tunnel with `ngrok http 4005` and register the webhook URL + secret on
Razorpay's dashboard.