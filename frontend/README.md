# Matiks Moderation Frontend

> **Next.js 14 · React 18 · TypeScript · Tailwind CSS · Vercel**  
> Professional moderation dashboard — no external icon libraries, zero bloat.

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Local Development Setup](#local-development-setup)
3. [Environment Variables](#environment-variables)
4. [Vercel Deployment — Step by Step](#vercel-deployment--step-by-step)
5. [UI & Display Logic](#ui--display-logic)
6. [Troubleshooting](#troubleshooting)

---

## Project Structure

```
frontend/
├── app/
│   ├── globals.css        ← Tailwind directives + base styles + animations
│   ├── layout.tsx         ← Root layout + SEO metadata + Inter font
│   └── page.tsx           ← Complete single-page moderation dashboard
├── .env.example           ← Template — copy to .env.local
├── .gitignore
├── next.config.js
├── package.json
├── postcss.config.js
├── tailwind.config.js
└── tsconfig.json
```

---

## Local Development Setup

### Prerequisites

- **Node.js v18+** (v20 LTS recommended)
- `npm`

### 1 — Clone & navigate

```bash
git clone <your-repo-url>
cd frontend
```

### 2 — Install dependencies

```bash
npm install
# Only Next.js, React, and Tailwind dev tools — no icon libraries
```

### 3 — Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 4 — Start the dev server

```bash
npm run dev
# → http://localhost:3000
```

### 5 — (Optional) verify production build

```bash
npm run build && npm run start
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | ✅ Yes | Base URL of the FastAPI backend — **no trailing slash** |

| Environment | Example value |
|---|---|
| Local dev | `http://localhost:8000` |
| Production | `https://your-service-name.onrender.com` |

> ⚠️ `NEXT_PUBLIC_` variables are **visible in the browser bundle**. Never put secrets (API keys, passwords) in them.

---

## Vercel Deployment — Step by Step

### Step 1 — Create a Vercel account

[vercel.com](https://vercel.com) → sign in with GitHub.

### Step 2 — Import your repository

1. Dashboard → **Add New → Project**
2. Select your repository

### Step 3 — Set Root Directory

Under **Configure Project** → **Root Directory** → type `frontend`.

Framework, build command, and output directory are auto-detected.

| Auto-detected setting | Value |
|---|---|
| Framework | Next.js |
| Build Command | `npm run build` |
| Output Directory | `.next` |
| Node.js | 20.x |

### Step 4 — Add environment variables

Before clicking **Deploy**, click **Environment Variables** and add:

| Key | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://your-render-service.onrender.com` |

Apply to **Production**, **Preview**, and **Development** environments.

### Step 5 — Deploy

Click **Deploy** — Vercel builds and deploys in ~60 seconds.

Your URL:
```
https://your-project-name.vercel.app
```

### Step 6 — Wire up CORS on the backend ⚠️ Required

After you have your Vercel URL, go to the Render dashboard → your backend service → **Environment** tab:

```
FRONTEND_URL = https://your-project-name.vercel.app
```

Click **Save Changes** (triggers an automatic redeploy on Render).

Without this step, browsers will block every API call with a CORS error.

> **Note:** All `*.vercel.app` preview URLs are already covered by a wildcard regex in the backend's CORS config — you only need to set `FRONTEND_URL` once for your production URL.

---

## UI & Display Logic

### Result card — "Safe" verdict

When `is_flagged === "No"`:

- 🟢 **Green glow** on the result card
- Banner reads **"✅ Safe — No Political Content"**
- `is_flagged` tile shows `No` in **emerald green**
- `reason_tag` tile shows `none` in **indigo**
- Explanatory note: post cleared for publication

### Result card — "Flagged" verdict

When `is_flagged === "Yes"`:

- 🔴 **Red glow** on the result card
- Banner reads **"🚩 Flagged: Political Content"**
- `is_flagged` tile shows `Yes` in **red**, with a pulsing dot
- `reason_tag` tile shows `political` in **indigo**
- Explanatory note: post held for human review

### Other UI components

| Component | Description |
|---|---|
| **NavBar** | Sticky glassmorphism with Matiks branding and "Groq Vision AI" pill |
| **Pipeline Bar** | 3-step indicator (Upload → Vision → Verdict) |
| **Drop Zone** | Drag-and-drop or click-to-browse with live preview and clear button |
| **Caption Textarea** | Optional, with live character counter |
| **Submit Button** | Disabled (greyed out) until an image is selected |
| **Loading Skeleton** | Animated shimmer bars while the API call is in-flight |
| **Error Banner** | Contextual error message with red styling |

---

## Troubleshooting

### `NEXT_PUBLIC_API_URL is not configured`

Add the variable to `.env.local` (local dev) or Vercel's Environment Variables panel (production), then redeploy.

### CORS error in browser console

Set `FRONTEND_URL` on Render to your exact Vercel URL and redeploy. Also ensure no trailing slash in either URL.

### API returns `502` — Groq model error

Your backend's `GROQ_MODEL` might not be a vision-capable model. Use `meta-llama/llama-4-maverick-17b-128e-instruct` — see the backend README.

### Image preview not showing

`URL.createObjectURL()` is a browser API — no server involved. If it fails, check the browser console for a security or memory error.
