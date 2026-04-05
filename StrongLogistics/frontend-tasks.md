# 🚚 LogiFlow — Frontend Project Tasks

> **Stack:** React, React Router, React Leaflet, Axios, TailwindCSS (or similar utility CSS)
> **Auth roles:** Admin, Dispatcher, Driver
> **Backend:** Django REST API (handled by separate team) — see API Contract section below
> **Goal:** Build a functional, clean dashboard MVP for dynamic logistics resource distribution

---

## 📁 Project Structure

```
src/
├── api/            # Axios instances + all API call functions
├── components/     # Reusable UI components
├── pages/          # Top-level route pages
├── features/       # Feature-specific components (orders, map, routing)
├── hooks/          # Custom React hooks
├── context/        # Auth context, global state
├── utils/          # Helper functions (priority colors, route formatting, etc.)
└── types/          # TypeScript types / JSDoc typedefs
```

---

## 🔧 PHASE 0 — Project Setup

- [ ] **0.1** Initialize React app (Vite + React)
- [ ] **0.2** Set up React Router v6 with route structure:
  - `/login`
  - `/dashboard` (redirect root here)
  - `/orders`
  - `/map`
  - `/admin` (admin-only)
- [ ] **0.3** Install and configure dependencies:
  - `axios` — HTTP client
  - `react-leaflet` + `leaflet` — map
  - `react-query` (TanStack Query) — server state / caching
  - `tailwindcss` — styling
  - `react-hook-form` — forms
  - `date-fns` — date formatting
- [ ] **0.4** Set up Axios base instance (`src/api/client.js`) with:
  - `baseURL` from `.env` (`VITE_API_URL`)
  - JWT token injection via request interceptor
  - 401 auto-logout via response interceptor
- [ ] **0.5** Set up `.env.example` with all required env vars documented
- [ ] **0.6** Set up ESLint + Prettier config
- [ ] **0.7** Create global layout component (sidebar nav + top bar + main content area)

---

## 🔐 PHASE 1 — Authentication

- [ ] **1.1** Build `/login` page with email + password form
- [ ] **1.2** Call `POST /api/auth/login/` — store JWT access + refresh tokens in `localStorage`
- [ ] **1.3** Create `AuthContext` — exposes `user`, `role`, `login()`, `logout()`
- [ ] **1.4** Create `PrivateRoute` wrapper — redirects to `/login` if not authenticated
- [ ] **1.5** Create `RoleGuard` component — hides/shows UI elements based on role (`admin`, `dispatcher`, `driver`)
- [ ] **1.6** Implement token refresh logic — auto-call `POST /api/auth/refresh/` before expiry
- [ ] **1.7** Logout button in nav — clears tokens, redirects to `/login`

**API contract (needs backend):**
```
POST /api/auth/login/       { email, password } → { access, refresh, user: { id, name, role } }
POST /api/auth/refresh/     { refresh } → { access }
GET  /api/auth/me/          → { id, name, role }
```

---

## 📊 PHASE 2 — Dashboard Page

- [ ] **2.1** Create `/dashboard` page with summary stat cards:
  - Total active orders
  - Critical priority orders count
  - Orders pending dispatch
  - Available drivers
- [ ] **2.2** Fetch stats from `GET /api/dashboard/stats/`
- [ ] **2.3** Add recent orders mini-list (last 5, with status badge)
- [ ] **2.4** Add quick-action button: "Create Order" (opens modal — see Phase 4)
- [ ] **2.5** Auto-refresh stats every 30 seconds (use React Query `refetchInterval`)

**API contract:**
```
GET /api/dashboard/stats/  → { active_orders, critical_count, pending_dispatch, available_drivers }
```

---

## 📋 PHASE 3 — Orders List Page

- [ ] **3.1** Create `/orders` page with a full data table of all orders
- [ ] **3.2** Each row shows: Order ID, destination point, resource type, quantity, priority, status, assigned driver, created at
- [ ] **3.3** Implement column sorting (client-side for loaded data)
- [ ] **3.4** Implement filters:
  - By status (pending / in-transit / delivered / cancelled)
  - By priority (normal / elevated / critical)
  - By date range
- [ ] **3.5** Implement search by order ID or destination name
- [ ] **3.6** Clicking a row opens an Order Detail sidebar/drawer with full info
- [ ] **3.7** Order Detail shows: all fields + status history timeline + assigned driver info
- [ ] **3.8** Dispatcher/Admin can change order status from the detail drawer
- [ ] **3.9** Add pagination (page size 20, server-side)
- [ ] **3.10** Priority badges with color coding:
  - 🟢 Normal — green
  - 🟡 Elevated — yellow/amber
  - 🔴 Critical — red (with pulse animation)

**API contract:**
```
GET  /api/orders/?page=1&status=&priority=&search=   → { results: [...], count, next, previous }
GET  /api/orders/:id/                                → { ...full order object }
PATCH /api/orders/:id/                               { status } → updated order
```

---

## 🗺️ PHASE 4 — Map Page

- [ ] **4.1** Create `/map` page with full-screen React Leaflet map (OpenStreetMap tiles)
- [ ] **4.2** Fetch all delivery points from `GET /api/points/` and render as markers
- [ ] **4.3** Color-code markers by highest active order priority at that point:
  - No orders → grey
  - Normal → green
  - Elevated → yellow
  - Critical → red (blinking/pulsing marker)
- [ ] **4.4** Clicking a marker opens a right-side panel (sidebar) showing:
  - Point name, address, coordinates
  - Current inventory/resource stock levels
  - List of active orders for this point (with priority badges)
  - "Create Order" button for this point
- [ ] **4.5** "Create Order" button in sidebar opens the Create Order modal (pre-filled with this point)
- [ ] **4.6** Map auto-refreshes marker states every 60 seconds
- [ ] **4.7** Add map legend (color key for priorities)
- [ ] **4.8** Add cluster support for many nearby markers (`react-leaflet-cluster`)

**API contract:**
```
GET /api/points/             → [{ id, name, address, lat, lng, stock: [{resource_id, quantity}] }]
GET /api/points/:id/orders/  → [{ ...order }]
```

---

## 📦 PHASE 5 — Create Order Modal

- [ ] **5.1** Build reusable `<CreateOrderModal>` component (triggered from dashboard, orders page, map sidebar)
- [ ] **5.2** Form fields:
  - Delivery point (searchable dropdown, fetched from `GET /api/points/`)
  - Resource type (dropdown, fetched from `GET /api/resources/`)
  - Quantity (number input with min/max validation)
  - Priority level (select: normal / elevated / critical)
  - Notes (optional textarea)
- [ ] **5.3** On resource + point selection → fetch and display current stock level at that point
- [ ] **5.4** Submit calls `POST /api/orders/`
- [ ] **5.5** On successful submit → invalidate orders query cache, show success toast

**API contract:**
```
GET  /api/resources/   → [{ id, name, unit }]
POST /api/orders/      { point_id, resource_id, quantity, priority, notes } → created order
```

---

## 🗺️ PHASE 6 — Route Optimization on Map

- [ ] **6.1** While filling out the Create Order modal, if a delivery point is selected → draw a suggested route on the map from the warehouse/depot to that point using Leaflet Routing Machine or OSRM
- [ ] **6.2** Show estimated distance and travel time on the modal
- [ ] **6.3** If multiple orders are being composed (batch), update route to show multi-stop path
- [ ] **6.4** Route line color matches the highest-priority order in the batch

**Notes for backend team:** Route calculation can use OSRM public API or a self-hosted instance. Frontend will call `GET /api/route/?from=<depot_id>&stops=<point_id1>,<point_id2>` or directly query OSRM.

```
GET /api/route/?from=depot&stops=3,7,12  → { waypoints: [{lat,lng}], distance_km, duration_min }
```

---

## 🤖 PHASE 7 — Auto-Assign Orders ("Pick Up Orders" Feature)

- [ ] **7.1** Add "Auto-assign orders" button (Dispatcher/Admin only, visible on Orders page and Dashboard)
- [ ] **7.2** On click → call `POST /api/orders/auto-assign/` with current driver context
- [ ] **7.3** Show a loading state while backend calculates optimal distribution
- [ ] **7.4** On response → show a modal/drawer with the proposed assignment plan:
  - List of orders grouped by driver
  - Optimized delivery route per driver shown on map
  - Summary: total distance, estimated time
- [ ] **7.5** Dispatcher can confirm or reject the proposed plan
- [ ] **7.6** On confirm → call `POST /api/orders/auto-assign/confirm/` with the plan ID

**API contract:**
```
POST /api/orders/auto-assign/          { driver_ids?: [] } → { plan_id, assignments: [{ driver, orders: [], route }] }
POST /api/orders/auto-assign/confirm/  { plan_id } → { success }
```

---

## 🔔 PHASE 8 — Urgent Request Handling

- [ ] **8.1** Orders with `priority: critical` trigger a toast notification when created or updated (all connected dispatcher sessions)
- [ ] **8.2** Implement WebSocket connection to `ws://<backend>/ws/notifications/` for real-time alerts
- [ ] **8.3** Notification bell icon in top nav — shows unread count badge
- [ ] **8.4** Notifications dropdown lists recent alerts with timestamps
- [ ] **8.5** Critical orders blink/pulse on map and orders list until acknowledged

**API contract:**
```
WS  /ws/notifications/   → streams { type: "new_order" | "status_change" | "critical_alert", payload: {...} }
```

---

## 🔍 PHASE 9 — Nearby Points with Stock (Bonus Feature)

- [ ] **9.1** On the map sidebar for a point, add "Nearby stock" button
- [ ] **9.2** On click → call `GET /api/points/nearby/?point_id=X&resource_id=Y&radius=50` 
- [ ] **9.3** Highlight nearby points on the map that have the requested resource in stock
- [ ] **9.4** Show ranked list in sidebar: closest first, with available quantity

**API contract:**
```
GET /api/points/nearby/?point_id=&resource_id=&radius_km=  → [{ point, distance_km, available_qty }]
```

---

## 🔒 PHASE 10 — Security & Offline Resilience

- [ ] **10.1** All API calls use HTTPS (enforced via env config)
- [ ] **10.2** JWT stored in `localStorage` with XSS mitigation (sanitize all rendered user content)
- [ ] **10.3** Sensitive fields (quantities, resource names) never logged to console in production build
- [ ] **10.4** Add offline detection banner — shows "You are offline, data may be outdated" when `navigator.onLine` is false
- [ ] **10.5** React Query caches last successful responses — UI stays functional with stale data when offline
- [ ] **10.6** Failed mutations (order creates/updates) queue locally and retry on reconnect (use React Query `retry` + `onReconnect`)

---

## 👤 PHASE 11 — Admin Panel

- [ ] **11.1** Create `/admin` page (Admin role only)
- [ ] **11.2** User management table: list all users, roles, active status
- [ ] **11.3** Create new user form (name, email, role, password)
- [ ] **11.4** Edit/deactivate existing users
- [ ] **11.5** Resource management: add/edit/remove resource types
- [ ] **11.6** Delivery points management: add/edit/remove points (with map picker for coordinates)

**API contract:**
```
GET    /api/admin/users/         → [{ id, name, email, role, is_active }]
POST   /api/admin/users/         { name, email, role, password } → created user
PATCH  /api/admin/users/:id/     { role?, is_active? } → updated user
GET    /api/admin/resources/     → [{ id, name, unit }]
POST   /api/admin/resources/     { name, unit } → created resource
GET    /api/admin/points/        → [{ id, name, address, lat, lng }]
POST   /api/admin/points/        { name, address, lat, lng } → created point
PATCH  /api/admin/points/:id/    { ...fields } → updated point
```

---

## 🎨 PHASE 12 — Polish & UX

- [ ] **12.1** Add loading skeletons for all data tables and map
- [ ] **12.2** Add empty states (no orders, no points, etc.)
- [ ] **12.3** Add error states with retry buttons
- [ ] **12.4** Toast notification system (success / error / warning)
- [ ] **12.5** Responsive layout — usable on tablet (warehouse use case)
- [ ] **12.6** Keyboard accessibility for modals and dropdowns
- [ ] **12.7** Consistent color theme — dark sidebar, light content area (standard dashboard look)
- [ ] **12.8** Favicon + page title updates per route

---

## 📤 PHASE 13 — Build & Handoff

- [ ] **13.1** Set up production build (`vite build`) and verify output
- [ ] **13.2** Document all env variables in `README.md`
- [ ] **13.3** Write brief API integration guide for backend team
- [ ] **13.4** Add `README.md` with setup instructions (install, run dev, run prod)
- [ ] **13.5** Verify all API base URLs are env-driven (no hardcoded localhost)

---

## 🔗 Summary of All API Endpoints (for Backend Team)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login/` | Login, returns JWT |
| POST | `/api/auth/refresh/` | Refresh access token |
| GET | `/api/auth/me/` | Current user info |
| GET | `/api/dashboard/stats/` | Summary stats |
| GET | `/api/orders/` | Paginated orders list |
| GET | `/api/orders/:id/` | Single order detail |
| POST | `/api/orders/` | Create order |
| PATCH | `/api/orders/:id/` | Update order status |
| POST | `/api/orders/auto-assign/` | Trigger auto-assign algorithm |
| POST | `/api/orders/auto-assign/confirm/` | Confirm proposed plan |
| GET | `/api/points/` | All delivery points |
| GET | `/api/points/:id/orders/` | Orders for a point |
| GET | `/api/points/nearby/` | Nearby points with stock |
| GET | `/api/resources/` | Available resource types |
| GET | `/api/route/` | Optimized route calculation |
| WS | `/ws/notifications/` | Real-time alerts stream |
| GET/POST/PATCH | `/api/admin/users/` | User management |
| GET/POST | `/api/admin/resources/` | Resource management |
| GET/POST/PATCH | `/api/admin/points/` | Points management |