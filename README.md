# 🚚 StrongLogistics — Logistics Management Dashboard

StrongLogistics is a web dashboard for coordinating dynamic resource distribution in logistics operations. It gives dispatchers and admins a single place to create and track delivery orders, monitor driver availability, visualize delivery points on an interactive map, and trigger an automated order-assignment algorithm — replacing manual coordination over phone or spreadsheets.

## The Problem It Solves

Managing logistics across many delivery points, drivers, and resource types is chaotic without dedicated tooling. Dispatchers need to know at a glance:

- Which orders are pending, in transit, or critical?
- Where are the delivery points, and what stock do they currently hold?
- Which drivers are available and how should orders be distributed among them?

StrongLogistics centralizes all of that into one real-time dashboard, with role-based access so admins, dispatchers, and drivers each see exactly what they need.

## Core Functionality

- **Role-based access** — JWT authentication with three roles: Admin, Dispatcher, and Driver
- **Dashboard** — KPI cards (active orders, critical count, pending dispatch, available drivers) with a recent-orders summary and auto-assignment shortcut
- **Orders management** — Paginated data table with filtering by status and priority, full-text search, column sorting, and an inline detail drawer for status updates and history timeline
- **Interactive map** — OpenStreetMap via React Leaflet; delivery point markers are color-coded by their highest active order priority (grey → green → yellow → red/pulsing for critical); marker clusters keep the view clean at scale
- **Map sidebar** — Click any marker to see point details, current stock levels, active orders, and a "Nearby stock" finder that highlights alternative points with available resources
- **Auto-assign** — One-click optimized order distribution across available drivers; proposed plan shown for review before confirmation
- **Create Order modal** — Available from the dashboard, orders list, and map sidebar; pre-fills the delivery point when opened from the map; shows live stock level for the selected resource/point combination
- **Real-time notifications** — WebSocket connection streams critical alerts and status changes; notification bell with unread count badge
- **Offline resilience** — Offline banner, stale-data serving from React Query cache, and automatic mutation retry on reconnect
- **Admin panel** — User, resource type, and delivery point management (Admin role only)

## Tech Stack

- **React 19** with TypeScript
- **Vite** for development and production builds
- **TailwindCSS v4** for styling
- **React Router v7** for client-side routing
- **TanStack Query (React Query v5)** for server state and caching
- **React Leaflet v5** + `react-leaflet-cluster` for the map
- **React Hook Form** for form handling
- **Axios** for HTTP with JWT interceptors
- **date-fns** for date formatting

## Setup

### Prerequisites

- Node.js 18+
- npm 9+
- A running StrongLogistics backend (Django REST API)

### Installation

```bash
npm install
```

### Configuration

```bash
cp .env.example .env
```

Edit `.env` to point to your backend:

```env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

### Development

```bash
npm run dev
```

### Production Build

```bash
npm run build
```

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `VITE_API_URL` | Backend REST API base URL | `http://localhost:8000` |
| `VITE_WS_URL` | WebSocket server base URL | `ws://localhost:8000` |

## Project Structure

```
src/
├── api/            # Axios client + API call functions
├── components/     # Reusable UI components
├── pages/          # Route-level page components
├── features/       # Feature-specific components (modals, drawers, map)
├── hooks/          # Custom React hooks
├── context/        # Auth, Toast, and Notification contexts
├── utils/          # Helper utilities
└── types/          # TypeScript interfaces
```

## Auth Roles

| Role | Access |
|---|---|
| **Admin** | Full access, including the admin panel |
| **Dispatcher** | Can create and manage orders, trigger auto-assign |
| **Driver** | Read-only view of assigned orders |
