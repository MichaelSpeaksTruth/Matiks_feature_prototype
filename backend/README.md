# Matiks Moderation Backend

> **FastAPI · Python 3.11 · Render · Groq Vision API**  
> Lightweight political content moderation — ~50 MB, no local ML models.

---

## ⚡ Quick Summary

| Item | Detail |
|---|---|
| **Framework** | FastAPI 0.111 + Uvicorn |
| **Dependencies** | 4 packages only (`fastapi`, `uvicorn`, `python-multipart`, `groq`) |
| **Vision inference** | Groq Vision API (cloud) |
| **Default model** | `meta-llama/llama-4-maverick-17b-128e-instruct` |
| **RAM usage** | ~50 MB (well within Render 512 MB free tier) |
| **Response format** | `{ "reason_tag": "political"\|"none", "is_flagged": "Yes"\|"No" }` |

---

## ⚠️ Model Selection — Read Before Deploying

> **`qwen/qwen3.6-27b` is a TEXT-ONLY model on Groq.** It does not accept image inputs and will throw a `400 Bad Request` error if you attempt to pass an image. Do **not** use it for this endpoint.

Use one of these **vision-capable (multimodal)** models instead:

| Model identifier | Notes |
|---|---|
| `meta-llama/llama-4-maverick-17b-128e-instruct` | ✅ **Recommended** — multimodal, 128 k context |
| `meta-llama/llama-4-scout-17b-16e-instruct` | ✅ Alternative — faster, also multimodal |

Full list: [console.groq.com/docs/vision](https://console.groq.com/docs/vision)

---

## Architecture

```
POST /moderate-post  (image file + optional caption)
           │
           ▼
   ┌───────────────────────────────────────────────────┐
   │  1. Validate MIME type  (must be image/*)         │
   │  2. Check file size     (hard cap: 20 MB)         │
   │  3. Base64-encode       data:{mime};base64,{data} │
   │  4. Build Groq request:                           │
   │       • system  → strict JSON-only prompt         │
   │       • user    → { image_url, text: caption }   │
   └──────────────────────┬────────────────────────────┘
                          │
                          ▼
              Groq Vision API (cloud)
                          │
                          ▼
   ┌───────────────────────────────────────────────────┐
   │  5. Parse JSON  (+ keyword-fallback if malformed) │
   │  6. Consistency guard on reason_tag / is_flagged  │
   └──────────────────────┬────────────────────────────┘
                          │
                          ▼
   { "reason_tag": "political"|"none",
     "is_flagged":  "Yes"     |"No"  }
```

---

## Table of Contents

1. [Local Development Setup](#local-development-setup)
2. [Environment Variables](#environment-variables)
3. [API Reference](#api-reference)
4. [Render Deployment — Step by Step](#render-deployment--step-by-step)
5. [Troubleshooting](#troubleshooting)

---

## Local Development Setup

### Prerequisites

- **Python 3.11** (3.10+ supported)
- `pip`

### 1 — Clone & navigate

```bash
git clone <your-repo-url>
cd backend
```

### 2 — Create virtual environment

```bash
python -m venv .venv

# macOS / Linux
source .venv/bin/activate

# Windows PowerShell
.\.venv\Scripts\Activate.ps1
```

### 3 — Install dependencies

```bash
pip install -r requirements.txt
# 4 packages, ~10 seconds
```

### 4 — Configure secrets

```bash
cp .env.example .env
# Open .env and paste your real GROQ_API_KEY
```

```env
GROQ_API_KEY=gsk_your_real_key_here
GROQ_MODEL=meta-llama/llama-4-maverick-17b-128e-instruct
FRONTEND_URL=http://localhost:3000
```

> 🔒 `.env` is already in `.gitignore`. Never commit it.

### 5 — Start the server

```bash
# macOS / Linux
export $(grep -v '^#' .env | xargs) && uvicorn main:app --reload --port 8000

# Windows PowerShell
Get-Content .env | Where-Object { $_ -notmatch '^#' -and $_.Trim() } | ForEach-Object {
    $k, $v = $_ -split '=', 2
    [System.Environment]::SetEnvironmentVariable($k.Trim(), $v.Trim())
}
uvicorn main:app --reload --port 8000
```

- API: `http://localhost:8000`
- Swagger UI: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GROQ_API_KEY` | ✅ Yes | — | Your Groq API key |
| `GROQ_MODEL` | No | `meta-llama/llama-4-maverick-17b-128e-instruct` | Must be a vision-capable model |
| `FRONTEND_URL` | No | — | Your Vercel deployment URL (added to CORS allow-list) |

---

## API Reference

### `GET /health`

Returns server status, configured model, and whether the API key is set.

```json
{
  "status": "healthy",
  "model": "meta-llama/llama-4-maverick-17b-128e-instruct",
  "api_key": "configured"
}
```

### `POST /moderate-post`

Analyse an image + optional caption for political content.

**Content-Type:** `multipart/form-data`

| Field | Type | Required | Constraints |
|---|---|---|---|
| `image` | file | ✅ Yes | JPEG, PNG, WebP, GIF — max 20 MB |
| `caption` | string | No | Up to 2 000 characters recommended |

**Success `200`:**

```json
{ "reason_tag": "political", "is_flagged": "Yes" }
```

```json
{ "reason_tag": "none", "is_flagged": "No" }
```

**Error codes:**

| Code | Cause |
|---|---|
| `400` | Not an image file, or corrupt upload |
| `413` | Image exceeds 20 MB |
| `503` | `GROQ_API_KEY` not configured |
| `502` | Groq API call failed |

---

## Render Deployment — Step by Step

### Step 1 — Create a Render account

[render.com](https://render.com) → connect GitHub.

### Step 2 — New Web Service

1. Dashboard → **New → Web Service**
2. Select your repository
3. **Root Directory** → `backend`

### Step 3 — Build & Start

| Setting | Value |
|---|---|
| Runtime | Python 3 |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn main:app --host 0.0.0.0 --port $PORT` |

### Step 4 — Environment Variables

Dashboard → your service → **Environment** tab:

| Key | Value |
|---|---|
| `GROQ_API_KEY` | Your Groq key from [console.groq.com/keys](https://console.groq.com/keys) |
| `GROQ_MODEL` | `meta-llama/llama-4-maverick-17b-128e-instruct` |
| `FRONTEND_URL` | `https://your-app.vercel.app` *(add after frontend deploy)* |

### Step 5 — Plan

| Plan | RAM | Cold start? |
|---|---|---|
| **Free** | 512 MB | Yes (~15 s after 15 min idle) |
| **Starter** ($7/mo) | 512 MB | No — always on |

> This backend uses ~50 MB, so the free tier is perfectly sufficient for memory. The only downside is the cold-start wake-up delay.

### Step 6 — Deploy & verify

After deploy, your URL is `https://<name>.onrender.com`.

```bash
curl https://<name>.onrender.com/health
# { "status": "healthy", "model": "...", "api_key": "configured" }
```

Copy this URL — you'll need it for `NEXT_PUBLIC_API_URL` in the frontend.

### Step 7 — Wire up CORS

Once the frontend is deployed to Vercel, come back and set:

```
FRONTEND_URL = https://your-app.vercel.app
```

Then trigger a **Manual Deploy** on Render.

---

## Troubleshooting

### `503 GROQ_API_KEY is not configured`

Set `GROQ_API_KEY` in Render's Environment tab and redeploy.

### `502 Groq Vision API call failed` — `400` from Groq

Your `GROQ_MODEL` is probably not vision-capable.  
Check the [Groq vision model list](https://console.groq.com/docs/vision) and use `meta-llama/llama-4-maverick-17b-128e-instruct`.

### `502` — `401 Unauthorized` from Groq

Your `GROQ_API_KEY` is invalid or expired. Generate a new one at [console.groq.com/keys](https://console.groq.com/keys).

### CORS errors in browser console

Ensure `FRONTEND_URL` on Render exactly matches your Vercel URL (no trailing slash).  
Trigger a Manual Deploy on Render after changing the variable.

### First request is slow (~15 s)

Render free tier spins down after 15 min of inactivity. The first request wakes it up. Subsequent requests are fast.
