# 🛍️ Store System — Full-Stack E-Commerce Platform with Real-Time Admin Dashboard & AI Assistant

A complete, production-ready e-commerce backend and storefront built with **Node.js, Express, and MongoDB**. It includes a customer-facing store, a full admin dashboard, a super-admin control panel, real-time notifications via **Socket.IO**, **Redis** caching/scaling, image uploads through **Cloudinary**, and a built-in **AI shopping assistant**.

This README is written so that **both developers and non-technical buyers** can understand what the system does, how it's built, and how to get it running — step by step, with no assumed prior knowledge.

---

## 📋 Table of Contents

1. [What This Project Is](#-what-this-project-is)
2. [Key Features](#-key-features)
3. [Who Is This For](#-who-is-this-for)
4. [Technology Stack](#-technology-stack)
5. [Project Structure](#-project-structure)
6. [User Roles & Permissions](#-user-roles--permissions)
7. [Prerequisites](#-prerequisites)
8. [Installation Guide (Step by Step)](#-installation-guide-step-by-step)
9. [Environment Variables Explained](#-environment-variables-explained)
10. [Running the Project](#-running-the-project)
11. [API Overview](#-api-overview)
12. [Real-Time Events (Socket.IO)](#-real-time-events-socketio)
13. [Scaling with PM2 & Redis](#-scaling-with-pm2--redis)
14. [Security Notes](#-security-notes)
15. [Load Testing](#-load-testing)
16. [Deployment Checklist](#-deployment-checklist)
17. [Troubleshooting](#-troubleshooting)
18. [License](#-license)

---

## 🧾 What This Project Is

This is a ready-to-use **online store (SaaS-style)** application. It has three "faces":

- **A public storefront** where customers browse products, view sections/categories, add reviews, place orders, and chat with an AI shopping assistant.
- **An admin dashboard** where store staff manage products, sections, coupons, and orders, and receive live notifications the moment something happens (new order, new review, etc.) — no page refresh needed.
- **A super-admin panel** where the store owner manages admin accounts (promote/demote users to admin) and overall store settings.

Everything is powered by a single Node.js backend (`server.js`) that serves both the HTML pages and the JSON API.

---

## ✨ Key Features

**Storefront (customers)**
- Product catalog with sections/categories
- Product detail pages with reviews & ratings
- Shopping cart and order placement
- User registration & login (JWT-based, stored in secure cookies)
- Built-in **AI Assistant** that can answer product questions and search the catalog on the customer's behalf
- Image uploads/delivery via Cloudinary (fast CDN-backed images)

**Admin Dashboard**
- Add / edit / delete products and sections
- Manage coupons (discounts)
- View and update order status (e.g. pending → shipped → delivered)
- View all customers and their orders
- **Live real-time updates** — new orders, new reviews, and status changes appear instantly via Socket.IO, without refreshing the page
- "Problems/support tickets" module for handling customer issues

**Super Admin**
- One-time secure super-admin setup flow
- Promote a regular user to admin, or demote an admin back to a regular user
- Full visibility over all store data

**Engineering / Infrastructure**
- Redis-backed caching for faster responses under load
- Redis adapter for Socket.IO so real-time events work correctly across multiple server processes (PM2 cluster mode)
- Rate limiting to protect against abuse and brute-force attacks
- Security headers via Helmet, input sanitization against NoSQL injection
- Gzip compression for faster page loads
- Graceful shutdown handling (closes DB/Redis connections cleanly on restart/deploy)
- PM2 ecosystem config included for production process management
- Artillery load-testing scripts included, with a sample performance report

---

## 👥 Who Is This For

| Buyer type | What you get |
|---|---|
| **Developers / Agencies** | A clean, well-commented Express + MongoDB codebase you can extend, rebrand, or plug into a client project. Clear separation of routes / controllers / models / middleware. |
| **Non-technical buyers / entrepreneurs** | A working store you can launch by simply filling in a configuration file (`.env`) — no need to write code. Follow the installation guide below exactly as written. |

---

## 🧱 Technology Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Web framework | Express.js |
| Database | MongoDB (via Mongoose ODM) |
| Real-time | Socket.IO (+ Redis adapter for multi-process scaling) |
| Caching | Redis (ioredis) |
| Authentication | JWT (JSON Web Tokens) stored in HTTP-only cookies |
| Password hashing | bcrypt |
| Image hosting | Cloudinary |
| Security | Helmet, express-rate-limit, express-mongo-sanitize |
| Process management | PM2 (cluster mode ready) |
| Load testing | Artillery |
| Frontend | Plain HTML, CSS, and JavaScript (no framework required — fast to customize) |

---

## 🗂 Project Structure

```
store/
├── server.js                  # Main entry point — starts Express, MongoDB, Socket.IO, Redis
├── config/
│   ├── redis.js                # Redis connection setup
│   └── ai_assistant.config.js  # AI assistant provider/model configuration
├── models/                     # MongoDB schemas (Mongoose)
│   ├── users.js
│   ├── products.js
│   ├── section.js
│   ├── order.js
│   ├── coupon.js
│   ├── problem.js
│   └── store.js
├── routes/                     # One file per API endpoint (29 total)
├── controller/                 # Business logic for each route
├── middleware/
│   ├── auth.js                 # Verifies logged-in user (JWT)
│   └── auth_super_admin.js     # Verifies admin/super-admin access
├── services/                   # AI assistant client & tools
├── utils/
│   └── cache.js                # Redis caching helpers
├── public/                     # Frontend (HTML/CSS/JS) — storefront, admin, super-admin pages
├── ecosystem.config.js         # PM2 production process configuration
├── artillery.yml               # Load-testing scenarios
└── .env                        # Your local configuration (never committed/shared)
```

---

## 🔐 User Roles & Permissions

The system has **three roles**, stored on each user account:

| Role | Can do |
|---|---|
| `user` (default) | Browse products, place orders, write reviews, use the AI assistant |
| `admin` | Everything a user can do, **plus**: manage products, sections, coupons, orders, and view all customers |
| `super_admin` | Everything an admin can do, **plus**: promote users to admin / demote admins back to users, access the super-admin setup panel |

Access is enforced on the backend via two middleware layers (`auth.js` for "must be logged in", `auth_super_admin.js` for "must be admin or super_admin"), so permissions can't be bypassed from the frontend.

---

## ✅ Prerequisites

Before installing, make sure you have:

1. **Node.js** version 18 or higher — [Download here](https://nodejs.org)
2. **MongoDB** — either:
   - A free cloud database from [MongoDB Atlas](https://www.mongodb.com/atlas) (recommended, no installation needed), or
   - MongoDB installed locally on your machine
3. **Redis** (optional but recommended for production) — a free instance from [Upstash](https://upstash.com) or [Redis Cloud](https://redis.com/try-free/) works well. The app runs fine without Redis on a single server; Redis becomes necessary once you run more than one server process.
4. **A Cloudinary account** (free tier is enough) for product image uploads — [Sign up here](https://cloudinary.com)
5. A code editor (e.g. VS Code) if you plan to customize anything

---

## 🚀 Installation Guide (Step by Step)

### 1. Extract the project
Unzip the project folder anywhere on your computer.

### 2. Install dependencies
Open a terminal inside the project folder and run:

```bash
npm install
```

This downloads all the libraries the project depends on (Express, Mongoose, Socket.IO, etc.).

### 3. Create your configuration file
Copy the example environment file:

```bash
cp .env.example .env
```

Then open `.env` in a text editor and fill in your own values — see the full explanation of every variable in the [Environment Variables](#-environment-variables-explained) section below.

### 4. Start the server

```bash
npm start
```

If everything is configured correctly, you'll see:

```
MongoDB conneted
Server running on http://localhost:3000
```

### 5. Open the store
Visit `http://localhost:3000` in your browser. You should see the storefront homepage.

### 6. Create your first Super Admin account
Go to `http://localhost:3000/super-admin-setup.html` and follow the on-screen steps to create the first super-admin account. **Do this once**, right after your first launch.

---

## 🔑 Environment Variables Explained

All configuration lives in a single `.env` file at the project root. Here is what each variable does:

| Variable | Required | Description |
|---|---|---|
| `MONGO_URL` | ✅ Yes | Your MongoDB connection string (e.g. from MongoDB Atlas). This is where all your data — users, products, orders — is stored. |
| `PORT` | No (default `3000`) | The port the server listens on. |
| `NODE_ENV` | ✅ Yes | Set to `production` when live/deployed, or `development` while testing locally. This also controls whether login cookies require HTTPS (`secure: true`). |
| `JWT_SECRET` | ✅ Yes | A long, random, secret string used to sign login tokens. **Never share this or use a weak value** — it's what keeps user sessions secure. Generate one with `openssl rand -hex 32`. |
| `AI_API_KEY` | Only if using the AI Assistant | Your API key for the AI provider (compatible with OpenAI-style chat APIs, e.g. Groq). |
| `AI_API_BASE_URL` | No | The API endpoint of your AI provider. Defaults to Groq's endpoint if not set. |
| `AI_MODEL` | No | Which AI model to use for the assistant. |
| `AI_TEMPERATURE` | No | Controls how creative vs. precise the AI assistant's answers are (0 = precise, 1 = creative). |
| `AI_MAX_OUTPUT_TOKENS` | No | Maximum length of the AI assistant's replies. |
| `AI_MAX_TOOL_ROUNDS` | No | Safety limit on how many internal "search" steps the AI can take per conversation. |
| `AI_MAX_SEARCH_RESULTS` | No | Maximum number of products the AI assistant can return in one search. |
| `AI_RATE_LIMIT_WINDOW_MS` / `AI_RATE_LIMIT_MAX` | No | Limits how often a single user can message the AI assistant, to control cost and prevent abuse. |
| `STORE_NAME` | ✅ Yes | Your store's display name, shown across the site. |
| `STORE_URL` | ✅ Yes | The public URL of your store (used for links, e.g. in emails or the AI assistant). |
| `REDIS_URL` | Recommended for production | Connection string for your Redis instance. Enables caching and correct real-time notifications when running multiple server processes. The app works without it on a single process. |
| `UV_THREADPOOL_SIZE` | No | Advanced Node.js performance tuning; safe to leave at the provided default. |
| `CLOUDINARY_CLOUD_NAME` | ✅ Yes (for image uploads) | Your Cloudinary account name. |
| `CLOUDINARY_UPLOAD_PRESET` | ✅ Yes (for image uploads) | An "unsigned upload preset" you create in your Cloudinary dashboard, which allows the storefront to upload images directly. |

> ⚠️ **Never commit or share your real `.env` file.** It contains secrets (database password, JWT secret, API keys) that, if leaked, allow full access to your store and data. Only `.env.example` (with placeholder values) should ever be shared or uploaded to GitHub.

---

## ▶️ Running the Project

| Command | What it does |
|---|---|
| `npm start` | Runs the server normally (good for production or simple testing) |
| `npm run dev` | Same as start — restart the process manually after code changes, or use `nodemon server.js` for auto-restart during development |

### Running with PM2 (recommended for production)
PM2 keeps the app running permanently, restarts it if it crashes, and can run it in **cluster mode** across multiple CPU cores:

```bash
npm install -g pm2
pm2 start ecosystem.config.js
```

> If you enable cluster mode (`instances: 'max'` in `ecosystem.config.js`), you **must** set `REDIS_URL` — otherwise real-time notifications (new orders, new products) will only reach some of your connected users instead of everyone.

---

## 🔌 API Overview

The backend exposes a REST-style JSON API under `/api/...`. Below is a summary grouped by area (see the `routes/` folder for the complete, exact list of endpoints):

| Area | Examples |
|---|---|
| **Auth** | Register, log in, check current session (`/api/auth/*`) |
| **Products** | List products, add/update/delete a product (admin only) |
| **Sections** | List, add, update, delete product categories (admin only) |
| **Orders** | Place an order, view your orders, view all orders (admin), update order status (admin), delete an order (admin) |
| **Reviews** | Post a review, get reviews for a product |
| **Coupons** | Add a discount coupon (admin only) |
| **Users / Admin management** | List all users (admin), promote a user to admin, demote an admin (super-admin only) |
| **Store settings** | Get current store configuration (name, contact info, etc.) |
| **AI Assistant** | Chat endpoint that lets customers ask questions about products |
| **Support ("Problems")** | Submit and list customer support issues |
| **Media** | Get Cloudinary upload configuration for the frontend |

Every protected route checks the user's login cookie and role before allowing access, so the same API safely serves customers, admins, and the super-admin from one codebase.

---

## ⚡ Real-Time Events (Socket.IO)

The admin dashboard updates live using Socket.IO — admins don't need to refresh the page to see new activity. On connecting, the frontend joins a room:

- `join_admin` → receives real-time events meant for staff (new order placed, new review posted, order status changed, etc.)
- `join_users` → receives events meant for regular customers (e.g. order status updates on their own orders)

When running more than one server process (PM2 cluster mode), the included **Redis adapter** makes sure these events reach every connected client, not just the ones connected to the same process that triggered the event.

---

## 📈 Scaling with PM2 & Redis

This project is built to scale beyond a single process out of the box:

- **Redis caching** (`utils/cache.js`) reduces repeated database lookups for frequently requested data (e.g. product lists, store settings).
- **Redis pub/sub adapter** keeps Socket.IO notifications consistent across all PM2 worker processes.
- **MongoDB connection pool** size is configurable — see the comments in `server.js` for guidance on tuning `maxPoolSize` correctly depending on whether you run a single process or PM2 cluster mode.

If you're running a small store on a single server, none of this is required to get started — Redis is optional until you need to scale.

---

## 🛡️ Security Notes

This project already includes several production-grade security practices:

- Passwords are hashed with **bcrypt** — never stored in plain text
- Login sessions use **HTTP-only JWT cookies** (not readable by JavaScript, reducing XSS risk); cookies are marked `secure` automatically in production so they're only sent over HTTPS
- **Helmet** sets standard security-related HTTP headers
- **express-mongo-sanitize** strips potentially malicious characters from user input to prevent NoSQL injection
- **Rate limiting** is applied globally to the API, with extra, stricter limits on login/registration to slow down brute-force attempts
- Role-based middleware ensures admin/super-admin routes cannot be accessed by regular users, even if they call the API directly

**Before going live, double-check:**
- [ ] `NODE_ENV=production` is set (this enables secure, HTTPS-only cookies)
- [ ] `JWT_SECRET` is a long, random, unique value — not the example/default
- [ ] Your real `.env` file is excluded from version control (already covered by `.gitignore`) and never shared publicly
- [ ] Your MongoDB and Redis instances require authentication and are not publicly open
- [ ] Rate limiting is active (it is, by default, as configured in `server.js`)

---

## 🧪 Load Testing

The project ships with an [Artillery](https://www.artillery.io/) load-testing setup (`artillery.yml`, `artillery-helper.js`) that simulates realistic traffic: guest browsing, existing customers logging in and ordering, and new customer sign-ups. A sample run (`report.json`) is included showing the app handling over **7,000 requests** with a **median response time of ~18ms** and less than 0.1% errors — useful as a baseline if you want to verify performance after customizing the code or before scaling up.

To run your own load test:

```bash
npx artillery run artillery.yml
```

---

## 🚢 Deployment Checklist

1. Set up a MongoDB Atlas cluster (or your own MongoDB server) and copy its connection string into `MONGO_URL`
2. Set up a Redis instance (Upstash/Redis Cloud) and copy the URL into `REDIS_URL`
3. Set up Cloudinary and fill in `CLOUDINARY_CLOUD_NAME` and `CLOUDINARY_UPLOAD_PRESET`
4. Set `NODE_ENV=production`
5. Generate a strong, unique `JWT_SECRET`
6. Deploy to your host of choice (VPS with PM2 + Nginx reverse proxy, Render, Railway, etc.)
7. Point your domain to the server and enable HTTPS (required for secure cookies to work)
8. Visit `/super-admin-setup.html` once to create your first super-admin account
9. Start adding sections and products from the admin dashboard

---

## 🧯 Troubleshooting

| Problem | Likely cause / fix |
|---|---|
| `MongoDB disconneted` in the console | Check that `MONGO_URL` is correct and that your IP is allow-listed in MongoDB Atlas |
| Login works but you're logged out immediately | `JWT_SECRET` may have changed, or cookies require HTTPS (`secure: true`) while you're testing on plain HTTP locally — use `NODE_ENV=development` locally |
| Real-time updates not appearing for some admins | You're likely running multiple processes (PM2 cluster) without `REDIS_URL` set — add it and restart |
| Image uploads fail | Double-check `CLOUDINARY_CLOUD_NAME` and `CLOUDINARY_UPLOAD_PRESET`, and that the preset is set to "unsigned" in your Cloudinary dashboard |
| AI Assistant not responding | Confirm `AI_API_KEY` is set and valid, and that `AI_API_BASE_URL` / `AI_MODEL` match a provider/model you actually have access to |

---

## 📄 License

This source code is sold/distributed as-is for use in your own project(s). You are free to customize, rebrand, and deploy it. Redistribution or resale of the source code itself (as a template/script) is not permitted unless you have an explicit license to do so from the original author.

---

**Enjoy building with this project!** If you run into issues not covered here, check the inline code comments throughout `server.js` and the `controller/` folder — the codebase is heavily commented to explain *why*, not just *what*.