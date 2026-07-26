# ProtoMatiks Content Moderation Lab

A zero-weight content evaluation prototype built on a secure server-side proxy architecture and a multi-tier parsing engine. The system delivers real-time political content verdicts with a zero false-positive design goal.

---

## Architecture Overview

### 1. Zero-Weight Cloud Proxy Design

Rather than running local deep-learning model files (which require 5 GB or more of RAM and dedicated GPU hardware), the backend operates as a lightweight network proxy. Uploaded images are converted to base64 data URIs and forwarded to the Groq Cloud API for inference.

- **Memory footprint:** Under 50 MB, well within Render's 512 MB free-tier limit.
- **No local ML models:** All vision inference is handled remotely by Groq.

### 2. Inference Engine: Groq + qwen/qwen3.6-27b

This system uses [Groq](https://groq.com) as its inference provider. The configured model is `qwen/qwen3.6-27b`.

`qwen/qwen3.6-27b` is a 27-billion parameter multimodal model that processes both text and image inputs simultaneously in a single inference pass. It is well-suited for this moderation pipeline for the following reasons:

- **Multimodal input:** Analyses the image and accompanying caption together, understanding visual content and textual context as a unified input rather than processing them independently.
- **Structured output:** Supports JSON-formatted responses natively, producing machine-readable verdicts consistently.
- **Explicit reasoning:** The model emits an internal chain-of-thought inside `<think>` blocks before outputting the final JSON object. The `max_tokens` budget is set to 1024 to ensure the reasoning block and the JSON verdict are never truncated.
- **Low latency:** Groq's LPU (Language Processing Unit) hardware delivers inference speeds that make real-time moderation viable without a dedicated GPU.

### 3. The Positive Proof Principle

All content is assumed safe by default. The model will only flag a submission if it can extract explicit, verifiable evidence of governance activity, state actors, electoral politics, or socio-political activism.

This approach eliminates false positives on technical diagrams, academic charts, or scientific graphs that happen to contain ambiguous terms such as "resistance", "party", or "left".

### 4. Multi-Tier Parsing Pipeline

To handle variability in LLM output formatting without relying on strict JSON mode (which can produce HTTP 400 errors on certain Groq model configurations), the backend implements a four-step recovery pipeline:

```
        Raw Text Response from Groq
                      |
                      v
        [Step 1: Outermost Brace Extractor]
       Locates first '{' and last '}' tokens.
       Discards any <think>...</think> preamble
       and any conversational suffix text.
                      |
                      v
         [Step 2: Standard JSON Parser]
              json.loads(extracted_text)
                      |
          .-----------+-----------.
        FAIL                   SUCCESS
          |                       |
          v                       v
   [Step 3: AST Parser]     Extract Fields
   ast.literal_eval()             |
   Handles single-quoted          |
   Python dict syntax             |
          |                       |
     .----+----.                  |
   FAIL      SUCCESS              |
     |          +----------.      |
     v                     v      v
[Step 4: Regex Scraper]   Return Verdict
 Extracts intent,
 is_flagged, reason_tag,
 and flagged_items via
 manual key-value regex
```

**Step 1 - Brace Extractor:** Locates the outermost `{` and `}` in the raw response string, isolating the JSON block and discarding any `<think>` reasoning prefix or trailing text.

**Step 2 - Standard JSON Parser:** Attempts `json.loads()` on the extracted block. Succeeds on well-formed output.

**Step 3 - AST Parser:** If Step 2 fails due to Python-style single-quoted keys or values, `ast.literal_eval()` parses the block as a Python dictionary.

**Step 4 - Regex Scraper:** If both parsers fail (for example, due to unescaped characters or missing commas), regular expressions extract the `intent`, `is_flagged`, `reason_tag`, and `flagged_items` values directly from the raw text.

### 5. Token Budget

The `max_tokens` parameter is set to 1024. This provides sufficient capacity for the model's internal `<think>` reasoning block followed by the final JSON object, preventing truncated or incomplete responses.

---

## Production Topology

This prototype operates at zero cost by leveraging free tiers across the full cloud stack.

| Component | Provider | Configuration |
|---|---|---|
| Frontend | Vercel hobby tier | Auto-deployed from the `frontend/` directory |
| Backend | Render web service free tier | Configured via `render.yaml` Blueprint; `rootDir` set to `backend/` |
| Inference | Groq developer free-use tier | Model: `qwen/qwen3.6-27b` |

### Render Free-Tier Keep-Alive

Render's free tier suspends the backend container after 15 minutes of inactivity. The next incoming request then incurs a cold-start delay of approximately 50 seconds.

To prevent this, configure an external uptime monitor on [Uptime Robot](https://uptimerobot.com) targeting the `/health` endpoint:

```
https://your-backend.onrender.com/health
```

Set the check interval to 5 minutes. The `/health` endpoint is purpose-built for this use case: it returns a minimal JSON status object and does not trigger any inference calls.

---

## Google Cloud Vision Integration

For higher-throughput or enterprise deployments, the Google Cloud Vision API can be introduced as a pre-processing layer before the Groq inference call. This hybrid approach reduces per-request token consumption significantly and adds specialised OCR and label detection capabilities.

### Pipeline

```
              Uploaded Image + Caption
                         |
                         v
          .------------------------------.
          |  Google Cloud Vision API     |
          '--------------.---------------'
                         |
            .------------+------------.
            v                         v
   [TEXT_DETECTION / OCR]     [LABEL_DETECTION,
   Extracts all text in        SAFE_SEARCH_DETECTION,
   the image, including        LANDMARK_DETECTION]
   handwriting and signs.      Returns object labels,
                               landmark names, safety
                               scores, and flag/logo
                               detections.
            |                         |
            '------------+------------'
                         v
          .------------------------------.
          |      Consolidated Metadata   |
          |  (OCR text + labels + tags)  |
          '--------------.---------------'
                         v
          .------------------------------.
          |  Groq: qwen/qwen3.6-27b      |
          |  Intent classification and   |
          |  final verdict JSON output   |
          '--------------.---------------'
                         v
                 Final Verdict JSON
```

### Implementation

Add the following helper function to `backend/main.py` and call it between the base64 encoding step and the Groq API call. Pass the returned metadata into the Groq prompt instead of the raw image data URI.

```python
from google.cloud import vision as gv

def _run_vision_api(raw_bytes: bytes) -> dict:
    """
    Sends the image to Google Cloud Vision API and returns structured metadata.

    Requires the GOOGLE_APPLICATION_CREDENTIALS environment variable to point
    to a valid service account JSON file.

    Returns a dict containing:
      labels    - list of detected object/scene labels
      ocr_text  - full OCR text extracted from the image
      landmarks - list of detected landmark names
      adult     - SafeSearch adult content likelihood string
      violence  - SafeSearch violence likelihood string
    """
    client   = gv.ImageAnnotatorClient()
    image    = gv.Image(content=raw_bytes)

    response = client.annotate_image({
        "image": image,
        "features": [
            {"type_": gv.Feature.Type.LABEL_DETECTION,    "max_results": 20},
            {"type_": gv.Feature.Type.TEXT_DETECTION},
            {"type_": gv.Feature.Type.SAFE_SEARCH_DETECTION},
            {"type_": gv.Feature.Type.LANDMARK_DETECTION, "max_results": 10},
        ],
    })

    labels    = [a.description for a in response.label_annotations]
    ocr_text  = response.full_text_annotation.text.strip() if response.full_text_annotation else ""
    landmarks = [a.description for a in response.landmark_annotations]
    safe      = response.safe_search_annotation

    return {
        "labels":    labels,
        "ocr_text":  ocr_text,
        "landmarks": landmarks,
        "adult":     str(safe.adult),
        "violence":  str(safe.violence),
    }
```

### Benefits of the Hybrid Model

**Token reduction.** Sending structured text metadata (labels, OCR output, landmark names) to Groq instead of the full image data URI can reduce input token consumption by over 90% per request.

**OCR coverage.** Google Cloud Vision handles over 50 languages, including handwriting, stylised typefaces, and text on signs or backgrounds, with no additional prompting.

**Landmark and symbol detection.** The Vision API returns structured labels for political landmarks (parliament buildings, monuments), government logos, and national flags without requiring the language model to identify them from raw pixels.

**SafeSearch pre-filtering.** The `SAFE_SEARCH_DETECTION` feature can reject clearly violating content (adult, violent) before the Groq inference call is made, reducing both latency and API usage.

**Intent classification remains with Groq.** After the Vision API extracts structured metadata, Groq reads the labels, OCR text, and user caption together to determine communicative intent and produce the final verdict JSON.

### Additional Setup for Vision Integration

Install the client library:

```bash
pip install google-cloud-vision
```

Add to `backend/requirements.txt`:

```
google-cloud-vision>=3.7.0
```

Add to `backend/.env`:

```
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

---

## Security

**Credential isolation.** All API credentials (`GROQ_API_KEY`, `FRONTEND_URL`) are stored in the server-side environment (`backend/.env`). No secrets are forwarded to or accessible from the client.

**CORS policy.** The API maintains an explicit origin allow-list plus a regex pattern that automatically covers all `*.vercel.app` preview and production URLs.

**Input validation.** All uploaded files are validated for MIME type and rejected if the content type is not an image. File size is capped at 20 MB server-side before any further processing.

---

## Environment Variables

### Backend (`backend/.env`)

Copy `backend/.env.example` to `backend/.env` and populate the following variables:

| Variable | Description |
|---|---|
| `GROQ_API_KEY` | Groq API key. Obtain from [console.groq.com/keys](https://console.groq.com/keys). |
| `GROQ_MODEL` | Groq model identifier. Defaults to `qwen/qwen3.6-27b`. |
| `FRONTEND_URL` | Production URL of the Vercel frontend (e.g. `https://your-app.vercel.app`). Used for CORS. |

### Frontend (`frontend/.env.local`)

Copy `frontend/.env.example` to `frontend/.env.local` and populate the following variables:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL of the deployed backend (e.g. `https://your-service.onrender.com`). No trailing slash. |

---

## Running Locally

### Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Set GROQ_API_KEY in .env before starting the server
uvicorn main:app --reload --port 8000
```

Interactive API documentation is available at `http://localhost:8000/docs` once the server is running.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:8000 in .env.local
npm run dev
```

Open `http://localhost:3000` in a browser.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS v3 |
| Backend | Python, FastAPI, Uvicorn, Pydantic |
| Inference | Groq Cloud API, model: qwen/qwen3.6-27b (multimodal) |
| Frontend hosting | Vercel (hobby free tier) |
| Backend hosting | Render (web service free tier, configured via `render.yaml`) |
| Keep-alive | Uptime Robot, polling `/health` every 5 minutes |

---

## API Reference

### GET /health

Returns the current server status and active model configuration.

```json
{
  "status":  "healthy",
  "model":   "qwen/qwen3.6-27b",
  "api_key": "configured"
}
```

### POST /moderate-post

Accepts a `multipart/form-data` request containing an image and an optional caption.

**Request fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `image` | file | Yes | Image file to moderate. Accepted types: JPEG, PNG, WebP, GIF. Maximum size: 20 MB. |
| `caption` | string | No | Text caption submitted alongside the image. |

**Response:**

```json
{
  "reason_tag":    "political" | "none",
  "is_flagged":    "Yes" | "No",
  "intent":        "<Concise description of the post purpose>",
  "flagged_items": ["<entity or phrase>"] | []
}
```
