# 🪔 श्री पूजा घर (Shree Pooja Ghar) — POS, Inventory & WhatsApp Automation System

[![Docker](https://img.shields.io/badge/Docker-Enabled-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io/)

A modern, high-performance **Point of Sale (POS), Multi-Batch Inventory Management, and Automated WhatsApp Receipting System** built specifically for Pooja item stores and retail shops (**श्री पूजा घर**, Ajmer).

---

## 🌟 Key Features

### 1. 🛒 POS Billing Terminal
* **Barcode Scanner Integration**: Fast item lookup via physical barcode scanner or quick search.
* **Instant Cart Controls**: Easily adjust quantities (`+` / `-`) or remove items from the live shopping cart.
* **Flexible Payment Methods**:
  * **UPI QR**: Generates dynamic UPI QR codes (`upi://pay?pa=...`) for instant customer scanning (GPay, PhonePe, Paytm, BHIM).
  * **Cash**: Dynamic change return calculator.
  * **Card & Khata (Credit)**: Track customer credit sales effortlessly.
* **Pinned Cart Layout**: Cart items stay pinned and fully visible even when large UPI QR codes are displayed.

### 2. 📦 Inventory & Stock Batch Management
* **Dual Language Support**: Product names in both **Hindi (हिंदी)** and **English**.
* **Profit Margin Selling Price Auto-Calculator**: Enter Purchase Cost + Profit Margin % → Selling Price auto-calculates in real-time.
* **Multi-Batch Stock Tracking**: FIFO stock deduction per batch with low-stock threshold alerts.
* **Product Image Uploads**: Product thumbnails rendered in inventory tables and POS cards.
* **Role Guarded Actions**: Product creation, stock batch addition, and item deletion restricted to `ADMIN` users.

### 3. 💬 Automated WhatsApp PDF Receipts
* **Background Queue (BullMQ + Redis)**: Generates PDF invoice receipts and sends them directly to customer WhatsApp numbers upon order completion.
* **Open Source WhatsApp Service**: Built-in `whatsapp-web.js` support.

### 4. 👥 Role-Based Access Control (RBAC)
* **ADMIN**: Full system control (Products, Stock Batches, Categories, Invoices, Customer LTV, Staff Accounts, Analytics, Store Settings).
* **CASHIER**: Dedicated billing terminal, view-only inventory/low-stock warnings. Restricted from adding/editing/deleting products, batches, categories, or invoice details.

### 5. 📱 Mobile Responsive Design
* **Glassmorphic UI**: High-contrast, dark mode aesthetic tailored with rich gradients and smooth micro-animations.
* **Mobile Touch Scroll**: Tables automatically scale with horizontal touch scrolling (`table-responsive`) so text and action buttons are never squished.
* **Slide-over Navigation**: Mobile drawer menu and tap-to-view user profile modal.

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend Framework** | [Next.js 16 (App Router)](https://nextjs.org/) |
| **Icons & UI** | [Lucide React](https://lucide.dev/), Vanilla Glassmorphism CSS |
| **Backend API** | [Node.js](https://nodejs.org/) + [Express.js](https://expressjs.com/) |
| **Database ORM** | [PostgreSQL 15](https://www.postgresql.org/) + [Prisma ORM 5](https://www.prisma.io/) |
| **Queue & Caching** | [Redis 7](https://redis.io/) + [BullMQ](https://bullmq.io/) |
| **WhatsApp Engine** | `whatsapp-web.js` + Puppeteer Headless Chromium |
| **Containerization** | Docker & Docker Compose |

---

## 🚀 Running with Docker (Recommended)

Run the entire application stack (PostgreSQL, Redis, Express Backend, Next.js Frontend) with a single command!

### 1. Prerequisites
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed on Linux, macOS, or Windows.

### 2. Start the Stack
From the project root directory, run:
```bash
docker-compose up --build -d
```

### 3. Seed Initial Demo Data (Admin & Cashier Users, Categories, Products)
Run the database seed command inside the backend container:
```bash
docker exec -it shree_pooja_backend npm run db:seed
```

### 4. Access the Application
* **Frontend POS Dashboard**: [http://localhost:3000](http://localhost:3000)
* **Backend REST API**: [http://localhost:3001/api/v1](http://localhost:3001/api/v1)

### 5. Stop Containers
```bash
docker-compose down
```

---

## 🔑 Default Login Credentials

After seeding the database, log in at [http://localhost:3000/login](http://localhost:3000/login):

| Role | Email | Password | Allowed Access |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@shreepooja.com` | `admin123` | Full Access (POS, Inventory, Categories, Staff, Reports, Settings) |
| **Cashier** | `cashier@shreepooja.com` | `cashier123` | POS Billing & View-Only Inventory/Invoices |

---

## 💻 Local Development Setup (Without Docker)

### 1. Service Prerequisites
Ensure PostgreSQL (`5432`) and Redis (`6379`) are running on your host machine.

### 2. Backend Setup
```bash
cd backend

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env # or update existing .env

# Run Prisma database migrations
npm run db:migrate

# Seed demo data
npm run db:seed

# Start backend server
npm run dev
```
*Backend will run on [http://localhost:3001](http://localhost:3001)*

### 3. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start Next.js dev server
npm run dev
```
*Frontend will run on [http://localhost:3000](http://localhost:3000)*

---

## ⚙️ Environment Variables Reference

### Backend (`/backend/.env`)

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `3001` | Express server port |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/shreepooja` | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `JWT_SECRET` | `shreepoojaghar-super-secret-jwt-key` | Secret key for JWT auth tokens |
| `WHATSAPP_PROVIDER` | `opensource` | WhatsApp service mode |
| `CORS_ORIGIN` | `*` | Allowed CORS origins |

---

## 📂 Project Architecture

```
shop/
├── backend/
│   ├── Dockerfile
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema & models
│   │   └── seed.js             # Initial database seed data
│   ├── src/
│   │   ├── controllers/        # Express route controllers
│   │   ├── middleware/         # Auth, RBAC & upload middlewares
│   │   ├── routes/             # API endpoints definitions
│   │   ├── services/           # Core business logic (Receipts, Products, WhatsApp)
│   │   └── server.js           # Express app bootstrap
│   └── uploads/                # Product image upload storage
├── frontend/
│   ├── Dockerfile
│   ├── app/
│   │   ├── (dashboard)/        # POS, Inventory, Invoices, Categories, Users, Settings
│   │   ├── login/              # Login screen
│   │   └── globals.css         # Design tokens & responsive table system
│   ├── context/                # AuthContext provider
│   └── public/                 # Static assets (logo.png, icons)
├── docker-compose.yml          # Multi-container orchestration
└── README.md                   # System documentation
```

---

## 📄 License
Created for **श्री पूजा घर** (Ajmer). All rights reserved.




env file 
backend : 
NODE_ENV=development
PORT=3001
 
# Database
DATABASE_URL="postgresql://postgres:postgrespassword@localhost:5432/shreepooja?schema=public"
DIRECT_URL="postgresql://postgres:postgrespassword@localhost:5432/shreepooja?schema=public"
 
# Redis
REDIS_URL="redis://localhost:6379"
 
# Authentication
JWT_SECRET="shreepoojaghr-super-secret-jwt-key-2024"
JWT_EXPIRES_IN="30d"
 
 
WHATSAPP_PROVIDER="opensource"
WHATSAPP_PHONE_PAIR="917877496745"
 
# CORS
CORS_ORIGIN="*"


frontend :
PII_ENCRYPTION_KEY=8f8815e6c8c4c6caef1209be3e4549e1d138864eacdcfb921954e3e481a230b6
 