# 🌾 AgriAssist (Smart Farming RGM)

> **Next-Generation AI-Driven Agricultural Intelligence & Real-Time Farm-to-Consumer Ecosystem**

AgriAssist is an advanced, hybrid cloud agricultural platform designed to bridge the gap between traditional farming and modern computational intelligence. It equips farmers with precision tools for disease detection, soil nutrition guidance, AI chatbot advisory, and dynamic crop pricing, while powering a direct, real-time farm-to-consumer marketplace with automated delivery tracking.

---

## 🏗️ System Architecture & Hybrid Data Model

AgriAssist leverages a **Hybrid Multi-Database Architecture** designed for high throughput, strict security, and zero downtime:

```mermaid
flowchart TD
    subgraph Frontend["React 18 + TypeScript Client (Vercel)"]
        UI_Farmer["Farmer Dashboard & Catalog Management"]
        UI_Consumer["Marketplace, Directory, AgriMarket & Consumer Dashboard"]
        UI_Tracking["OrderTracking & LiveTrackingMap (Leaflet GPS)"]
        AuthCtx["useAuth Context (MongoDB JWT + Supabase Shadow Session)"]
        SyncHook["useRealtimeSync Hook (/ws/sync WebSocket Client)"]
        MarketHook["MarketInsights WS Client (/ws/market-stream)"]
    end

    subgraph NodeServer["Node.js / Express Server (Render)"]
        AuthCtrl["Auth Controller (Register, Login, Nodemailer Verification, Reset)"]
        ProfileCtrl["Profile Controller (Farmer & Consumer Profiles)"]
        ProductCtrl["Product Controller (Catalog CRUD + Realtime Broadcast)"]
        SyncWSS["/ws/sync WebSocket Server (30s Keepalive Heartbeat)"]
        NodemailerClient["Nodemailer (Gmail SMTP Engine)"]
    end

    subgraph FastAPIEngine["Python 3.11 FastAPI AI Engine (Render)"]
        ML_Models["Crop, Soil NPK, Yield & Profit ML Models"]
        GroqLLM["Groq Cloud LLM Advisory Agent"]
        MarketEngine["Market Intelligence Stream (/ws/market-stream)"]
    end

    subgraph CloudData["Databases & Real-Time Cloud"]
        AtlasDB[("MongoDB Atlas (agriassist_db)
        • users (Credentials, Verification, Tokens)
        • farmers (Agricultural Profiles, Land, Crops)
        • consumers (Contact, Preferences, Capacity)
        • products (Listings, Pricing, Stock)")]
        
        SupabaseDB[("Supabase (PostgreSQL + Realtime)
        • orders & bulk_orders
        • delivery_tracking (Driver GPS Coordinates)
        • crop-disease-scan Edge Function")]
    end

    Frontend -->|JWT Bearer REST| NodeServer
    Frontend -->|Live Catalog Sync ws://| SyncWSS
    Frontend -->|Market Intelligence wss://| MarketEngine
    Frontend -->|Orders & Realtime GPS Filter| SupabaseDB

    NodeServer -->|Mongoose ODM| AtlasDB
    NodeServer -->|Verification & Reset Emails| NodemailerClient
    SyncWSS -->|Instant Broadcast Event| SyncHook
    SyncHook -->|Update State without Refresh| UI_Consumer

    FastAPIEngine -->|Inference & Analytics| GroqLLM
```

---

## 🎯 Partial Migration to MongoDB

To provide dedicated account management, custom email workflows, and independent catalog scaling, four core domains were migrated from Supabase to **MongoDB Atlas**, while preserving Supabase for order logistics and Realtime GPS tracking.

### 1. Migrated Domains (MongoDB Atlas)
- **Authentication & User Sessions**: Managed entirely via MongoDB with bcrypt password hashing (12 rounds) and JWT sessions.
- **Farmer Details & Profiles**: Farm dimensions, soil profile, water availability, primary & secondary crops, coordinates, and contact details.
- **Customer/Consumer Details & Profiles**: Delivery addresses, business classification (`household`, `retailer`, `wholesaler`, `hotel`), and bulk purchasing capacity.
- **Product Details & Catalog Management**: Real-time inventory, pricing, units (`kg`, `quintal`, `box`, `ton`), certifications, and direct farmer ownership links.

### 2. Preserved Domains (Supabase)
- **Order Management**: `orders`, `order_items`, `bulk_orders`, and `bids`.
- **Logistics & Delivery**: `delivery_tracking` (real-time driver GPS coordinate streams).
- **Edge AI**: Google Gemini-powered `crop-disease-scan` serverless function.

### 3. Dual-Identity Bridge & Shadow Session
To ensure existing Supabase Row-Level Security (RLS) policies continue to work for orders:
- MongoDB documents retain a bi-directional mapping via `supabaseId` and `supabaseFarmerId`.
- [`useAuth.tsx`](file:///d:/rgm/smart-framer-1-main/src/hooks/useAuth.tsx) maintains a silent Supabase shadow session alongside the primary MongoDB JWT.
- Frontend components never touch or expose the Supabase service-role key.

---

## 🔐 Complete Authentication & Nodemailer Verification

AgriAssist features a full-lifecycle authentication system:

```mermaid
sequenceDiagram
    autonumber
    actor User as Farmer / Consumer
    participant FE as React Frontend
    participant BE as Node.js Auth Service
    participant SMTP as Gmail SMTP (Nodemailer)
    participant DB as MongoDB Atlas

    User->>FE: Fill Registration Form (Role, Email, Password, Profile)
    FE->>BE: POST /api/auth/register
    BE->>DB: Check for existing account
    BE->>BE: Hash password with bcrypt (12 rounds)
    BE->>BE: Generate crypto random token (32 bytes) & SHA-256 hash
    BE->>DB: Save User with isEmailVerified=false & expiration (24h)
    BE->>SMTP: Send custom HTML verification email
    SMTP-->>User: Verification Email delivered
    BE-->>FE: 201 Created (Redirect to /verify-pending)

    Note over User,DB: Unverified Login Attempt Blocked
    User->>FE: Attempt Login before clicking link
    FE->>BE: POST /api/auth/login
    BE-->>FE: 403 Forbidden ("Please verify your email before logging in")

    Note over User,DB: Successful Verification
    User->>FE: Clicks verification link in email
    FE->>BE: POST /api/auth/verify-email { token }
    BE->>BE: SHA-256 hash token & query DB
    BE->>DB: Set isEmailVerified=true, clear tokens
    BE-->>FE: 200 OK ("Email verified successfully")
    FE->>FE: Redirect to /login
```

### Password Reset Lifecycle
- **Forgot Password**: Generates a single-use SHA-256 token valid for 1 hour; sends a branded password reset email via Nodemailer.
- **Reset Password**: Validates token freshness, updates the password hash, and invalidates the token to prevent replay attacks.
- **Security Features**: Email enumeration protection, IP rate-limiting, and sanitized JSON errors.

---

## ⚡ Real-Time WebSocket & Synchronization Layer

All real-time communication channels across AgriAssist have been audited, repaired, and decoupled for fault tolerance:

### 1. FastAPI `/ws/market-stream` (Market Intelligence)
- **Root Cause of Prior Failure**: Dependency mismatch (`uvicorn` lacked `websockets` protocol on Render) and memory leaks from dead connections.
- **Fix Implemented**:
  - Upgraded dependencies to `uvicorn[standard]` and `websockets>=12.0`.
  - Re-architected `ConnectionManager` with a set snapshot pattern to safely evict broken connections during broadcast.
  - Added an initial snapshot delivery: newly connected clients receive cached market data immediately.
  - Implemented bidirectional `ping`/`pong` keepalive to prevent Render free-tier proxy timeouts.
  - Frontend (`MarketInsights.tsx`) features auto-reconnection with exponential backoff and a 5-second HTTP polling fallback if the WebSocket is disconnected.

### 2. Node.js `/ws/sync` (Instant Farmer-to-Consumer Catalog Sync)
- **Purpose**: Eliminates manual page refreshes when farmers modify their profile, add new harvest listings, adjust prices, or delete products.
- **Architecture**:
  - Integrated native WebSocket server running on `/ws/sync`.
  - Node controllers invoke `broadcastSyncEvent` on all profile and product mutations.
  - Connected frontends (`Marketplace`, `FarmersDirectory`, `AgriMarket`, `ConsumerDashboard`, `DemandSupply`) subscribe via the centralized [`useRealtimeSync.ts`](file:///d:/rgm/smart-framer-1-main/src/hooks/useRealtimeSync.ts) hook and update React state immediately upon receiving events:
    - `FARMER_PROFILE_UPDATED`
    - `PRODUCT_CREATED`
    - `PRODUCT_UPDATED`
    - `PRODUCT_DELETED`

### 3. Supabase Realtime (Order Tracking & GPS)
- **Fix Implemented**:
  - Replaced global table subscriptions with scoped channel filters (`filter: "order_id=eq.${orderId}"`) in [`LiveTrackingMap.tsx`](file:///d:/rgm/smart-framer-1-main/src/components/LiveTrackingMap.tsx) and [`OrderTracking.tsx`](file:///d:/rgm/smart-framer-1-main/src/pages/consumer/OrderTracking.tsx).
  - Added an initial REST query on component mount so delivery maps render current coordinates immediately without waiting for the next movement ping.

---

## 📊 Database Schemas (MongoDB Atlas)

### `User` Collection
```typescript
interface IUser {
  _id: ObjectId;
  email: string;                  // Unique index, trimmed, lowercase
  password: string;               // Bcrypt hash (12 rounds)
  role: 'farmer' | 'consumer' | 'admin';
  supabaseId?: string;            // Shadow link to Supabase auth.users
  isEmailVerified: boolean;       // Default: false
  emailVerificationToken?: string;// SHA-256 hash
  emailVerificationExpires?: Date;// 24 hours
  passwordResetToken?: string;    // SHA-256 hash
  passwordResetExpires?: Date;    // 1 hour
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### `Farmer` Collection
```typescript
interface IFarmer {
  _id: ObjectId;
  userId: ObjectId;               // Ref -> User
  supabaseId?: string;
  fullName: string;
  phone: string;
  region: string;
  primaryCrop?: string;
  secondaryCrop?: string;
  landArea?: number;              // In Acres
  totalYield?: number;            // In Quintals
  monthlyProduction?: number;     // In Quintals
  expectedPrice?: number;         // In INR
  waterAvailability?: 'High' | 'Medium' | 'Low';
  farmingType?: 'Organic' | 'Conventional' | 'Mixed';
  latitude?: number;
  longitude?: number;
  avatarUrl?: string;
  isVerified: boolean;
}
```

### `Consumer` Collection
```typescript
interface IConsumer {
  _id: ObjectId;
  userId: ObjectId;               // Ref -> User
  supabaseId?: string;
  fullName: string;
  phone: string;
  deliveryAddress?: string;
  city?: string;
  state?: string;
  pincode?: string;
  consumerType?: 'household' | 'retailer' | 'wholesaler' | 'hotel';
  purchaseVolumeCapacity?: number;// In kg/month
  latitude?: number;
  longitude?: number;
}
```

### `Product` Collection
```typescript
interface IProduct {
  _id: ObjectId;
  farmerId: ObjectId;             // Ref -> Farmer
  userId: ObjectId;               // Ref -> User
  supabaseFarmerId?: string;
  name: string;                   // E.g. "Guntur Teja Chili"
  category: string;               // E.g. "Spices", "Produce", "Grains"
  farmingType?: string;           // "Organic" | "Conventional" | "Mixed"
  price: number;                  // Price per unit (INR)
  quantity: number;               // Current stock
  unit: 'kg' | 'quintal' | 'box' | 'ton';
  region?: string;
  description?: string;
  imageUrl?: string;
  status: 'available' | 'sold_out' | 'harvesting';
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 📡 API Reference

### Authentication Endpoints (`/api/auth`)
| Method | Endpoint | Description | Headers / Auth |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register farmer/consumer, hash password, send verification email | None |
| `POST` | `/api/auth/verify-email` | Verify single-use SHA-256 token and activate account | None |
| `POST` | `/api/auth/resend-verification` | Resend verification email with a freshly generated token | None |
| `POST` | `/api/auth/login` | Authenticate credentials. Returns `403` if unverified; returns JWT if verified | None |
| `POST` | `/api/auth/forgot-password` | Request password reset email | None |
| `POST` | `/api/auth/reset-password` | Submit new password with single-use reset token | None |
| `GET` | `/api/auth/me` | Fetch active user credentials and populated profile | `Authorization: Bearer <JWT>` |

### Profile Endpoints (`/api/profile`)
| Method | Endpoint | Description | Headers / Auth |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/profile` | Retrieve profile of the logged-in user | `Authorization: Bearer <JWT>` |
| `PUT` | `/api/profile` | Update profile in MongoDB & broadcast update to `/ws/sync` | `Authorization: Bearer <JWT>` |
| `GET` | `/api/profile/farmers` | Public directory of registered farmers (with filters & search) | None |
| `GET` | `/api/profile/farmers/:id`| Detailed profile of an individual farmer | None |

### Product Endpoints (`/api/products`)
| Method | Endpoint | Description | Headers / Auth |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/products` | Browse marketplace crops (search, price, category, pagination) | None |
| `GET` | `/api/products/farmer/me`| List all crops listed by the authenticated farmer | `Authorization: Bearer <JWT>` |
| `POST` | `/api/products` | Add new crop listing & broadcast to `/ws/sync` | `Authorization: Bearer <JWT>` (Farmer) |
| `PUT` | `/api/products/:id` | Update price/quantity & broadcast to `/ws/sync` | `Authorization: Bearer <JWT>` (Owner) |
| `DELETE`| `/api/products/:id` | Remove crop listing & broadcast to `/ws/sync` | `Authorization: Bearer <JWT>` (Owner) |

---

## 🧪 Automated Test Verification

All modules have dedicated automated test scripts that verify end-to-end functionality:

```bash
# 1. Test complete MongoDB Auth, Nodemailer, bcrypt, and JWT lifecycle
cd server
node src/scripts/testAuthFlow.js
# Result: 10/10 Tests Passed

# 2. Test Realtime Sync WebSocket (/ws/sync) & Instant Cross-Client Broadcast
node src/scripts/testRealtimeSyncFlow.js
# Result: 100% Passed (Handshake, Ping/Pong, Profile Update, Product CRUD Broadcasts)

# 3. Test FastAPI Market Stream (/ws/market-stream)
cd ../crop_guidance_ai
python test_market_ws.py
# Result: 100% Passed (Initial Cache Snapshot, Ping/Pong Keepalive)

# 4. Compile React + TypeScript Production Build
cd ..
npm run build
# Result: Built in 22.97s with 0 errors
```

---

## ⚙️ Environment Variables Reference

### Frontend (`.env`)
```env
VITE_API_URL=http://localhost:5000/api
VITE_FASTAPI_URL=https://smart-farming-rgm.onrender.com
VITE_SUPABASE_URL=https://nplfefcynvavsmfslwyg.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Node.js Server (`server/.env`)
```env
PORT=5000
MONGODB_URI=mongodb://somu:somu123@ac-u38d6tg-shard-00-00.uvbgsy8.mongodb.net:27017,ac-u38d6tg-shard-00-01.uvbgsy8.mongodb.net:27017,ac-u38d6tg-shard-00-02.uvbgsy8.mongodb.net:27017/agriassist_db?ssl=true&replicaSet=atlas-mc2r1g-shard-0&authSource=admin
JWT_SECRET=supersecret_agriassist_jwt_key_2026_x99a!
JWT_EXPIRES_IN=7d
EMAIL_USER=239x1a0554@gmail.com
EMAIL_PASS=bysinuzeesdeswfa
FRONTEND_URL=http://localhost:8080
SUPABASE_URL=https://nplfefcynvavsmfslwyg.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### FastAPI AI Engine (`crop_guidance_ai/.env`)
```env
GROQ_API_KEY=gsk_your_groq_api_key_here
```

---

## 🚀 Local Development Setup

### Prerequisites
- Node.js (v18.0.0 or higher)
- Python (v3.10 or higher)
- MongoDB Atlas account (or local MongoDB v6+)

### 1. Start Node.js Express & Realtime Sync Server
```powershell
cd server
npm install
node src/server.js
```
*Server runs on `http://localhost:5000` with WebSocket on `ws://localhost:5000/ws/sync`.*

### 2. Start Python FastAPI Engine
```powershell
cd crop_guidance_ai
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
*FastAPI runs on `http://localhost:8000` with market stream on `ws://localhost:8000/ws/market-stream`.*

### 3. Start Frontend Client
```powershell
npm install
npm run dev
```
*Vite dev server runs on `http://localhost:8080`.*

---

## 🌐 Production Deployment Guide

### Deploying Node.js Backend to Render
1. Create a **New Web Service** connected to your repository on [Render](https://dashboard.render.com).
2. Configure settings:
   - **Root Directory:** `server`
   - **Build Command:** `npm install`
   - **Start Command:** `node src/server.js`
3. Add the environment variables from `server/.env`.
4. Copy the service URL (e.g., `https://agriassist-node-server.onrender.com`).

### Deploying FastAPI Engine to Render
1. Create or update the existing Web Service on Render.
2. Configure settings:
   - **Root Directory:** `crop_guidance_ai`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
3. Add `GROQ_API_KEY` to Environment Variables.

### Deploying Frontend to Vercel
1. Import repository on [Vercel](https://vercel.com).
2. Select **Vite** preset (Root directory: `./`).
3. Set Environment Variables:
   - `VITE_API_URL` = `https://agriassist-node-server.onrender.com/api`
   - `VITE_FASTAPI_URL` = `https://smart-farming-rgm.onrender.com`
   - `VITE_SUPABASE_URL` = `https://nplfefcynvavsmfslwyg.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `...`
4. Click **Deploy**. SPA rewrites are automatically handled by [`vercel.json`](file:///d:/rgm/smart-framer-1-main/vercel.json).
5. Finally, update `FRONTEND_URL` in the Render Node.js environment to your new Vercel domain.

---

## 📄 License & Attribution
Developed for the **Smart Farmer Innovation Hackathon & AgriAssist Initiative**.
Built with React, Vite, Node.js, Express, MongoDB Atlas, FastAPI, Mongoose, Supabase, Groq LLM, and Leaflet.
