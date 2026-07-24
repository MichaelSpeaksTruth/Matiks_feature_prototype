# ProtoMatiks Content Moderation Lab

A highly optimized, zero-weight content evaluation prototype. The system uses a secure server-side proxy architecture coupled with a multi-tier parsing engine to deliver real-time verdicts with zero false positives.

---

## ⚡ Core Efficiency Architecture

The system achieves maximum processing speed and minimal memory consumption through several key engineering decisions:

### 1. Zero-Weight Cloud Proxy Design
* **Memory footprint:** Under 50 MB (runs safely on restricted 512 MB instances).
* **Approach:** Instead of running heavy deep-learning visual model files (which require 5 GB+ RAM and dedicated GPUs), the backend operates as a lightweight, secure network proxy. Image files are converted to base64 data URIs and processed via a secure cloud-based inference engine.

### 2. The Positive Proof Principle
* **Default state:** All content is assumed SAFE.
* **Criterion:** The AI engine will only flag content if it extracts explicit, verifiable evidence of governance, state actors, elections, or socio-political activism. 
* **Outcome:** This completely prevents false positives on technical drawings, academic plots, or scientific graphs that contain ambiguous terms (like "resistance" or "party").

### 3. Multi-Tier Parsing Safeguard
To bypass common LLM output syntax issues without using strict JSON-mode API constraints (which can throw HTTP 400 errors), the backend implements a three-tier recovery pipeline:

```
           Raw Text Response from AI Engine
                          │
                          ▼
           [Step 1: Outermost Brace Extractor]
          Locates first '{' and last '}' tokens
                          │
                          ▼
            [Step 2: Strict JSON Parser]
           Tries standard json.loads(text)
             (Succeeds on strict formats)
                          │
            ┌─────────────┴─────────────┐
          FAIL                        SUCCESS
            │                           │
            ▼                           ▼
     [Step 3: AST Parser]         Extract Fields
   Parses single-quoted dict            │
     (ast.literal_eval)                 │
            │                           │
      ┌─────┴─────┐                     │
    FAIL       SUCCESS                  │
      │           └──────────┐          │
      ▼                      ▼          ▼
[Step 4: Regex Scraper]    Return Clean Verdict
 Manual key-value regex
 (Extracts intent & items)
```

1. **Standard JSON Parser:** Handles standard JSON output.
2. **Abstract Syntax Tree (AST) Parser:** If standard JSON fails due to Python-style single quotes (`'key'`) instead of strict double quotes (`"key"`), `ast.literal_eval` parses the dict successfully.
3. **Regex Key-Value Scraper:** If both parsers fail due to unescaped characters or missing commas, custom regular expressions extract the `intent`, `is_flagged`, `reason_tag`, and `flagged_items` values directly from the text block.

### 4. Optimal Token Allocation
* The backend allows up to 1024 tokens for responses. This ensures that the engine has sufficient room to run its internal reasoning steps and output the final JSON payload without getting truncated.

---

## 🔒 Security & Secrets Protection

* **Credential Shielding:** All API connection parameters are stored exclusively in the server-side environment (`backend/.env`). No keys are exposed to the client-side browser.
* **CORS Lockdown:** The API is locked to authorized origins to prevent external resource hijacking.

---

## 📋 System Setup

### Environment Variables

#### Backend (`backend/.env`)
* `API_KEY`: Connection credential for the cloud engine.
* `MODEL_NAME`: Identifier of the moderation model.
* `FRONTEND_URL`: Production domain of your Vercel frontend.

#### Frontend (`frontend/.env.local`)
* `NEXT_PUBLIC_API_URL`: Base URL of your live backend API.

---

## 🚀 Running Locally

### Backend
1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
2. Start the FastAPI server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```

### Frontend
1. Install node packages:
   ```bash
   npm install
   ```
2. Start the Next.js dev server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:3000` in your browser.
