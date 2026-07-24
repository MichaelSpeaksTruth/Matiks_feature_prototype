"""
ProtoMatiks Political Content Moderation Backend — v3
=====================================================
Lightweight FastAPI proxy to Groq Vision API.

Memory footprint : ~50 MB  (safe on Render 512 MB free tier)
Dependencies     : fastapi · uvicorn · python-multipart · groq

Pipeline
────────
1. Receive  image (file) + caption (str | None)  via multipart/form-data
2. Validate MIME type & file size
3. Base64-encode the image  →  data URI
4. POST to Groq Vision API with a strict JSON-only system prompt
5. Parse / normalise the model's response
6. Return  { "reason_tag": "political"|"none",  "is_flagged": "Yes"|"No" }

Model notes
───────────
  Recommended  →  meta-llama/llama-4-maverick-17b-128e-instruct
                   (multimodal: text + image, 128 k context)
  Alternative  →  meta-llama/llama-4-scout-17b-16e-instruct
                   (faster, also multimodal)

  ⚠️  qwen/qwen3.6-27b is TEXT-ONLY on Groq and cannot process images.
      Do NOT use it for this endpoint.
"""

import os
import base64
import json
import logging
from typing import Optional

from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq

# ─────────────────────────────────────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger("protomatiks.moderation")

# ─────────────────────────────────────────────────────────────────────────────
# Configuration  (set via environment variables — never hard-code secrets)
# ─────────────────────────────────────────────────────────────────────────────
GROQ_API_KEY: str = os.environ.get("GROQ_API_KEY", "")
GROQ_MODEL:   str = os.environ.get(
    "GROQ_MODEL",
    "qwen/qwen3.6-27b",   # default
)
FRONTEND_URL: str = os.environ.get("FRONTEND_URL", "")
MAX_IMAGE_BYTES: int = 20 * 1024 * 1024  # 20 MB hard cap

if not GROQ_API_KEY:
    logger.warning(
        "⚠  GROQ_API_KEY is not set — all moderation requests will return 503 "
        "until this environment variable is configured."
    )

# ─────────────────────────────────────────────────────────────────────────────
# FastAPI application
# ─────────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title       = "ProtoMatiks Content Moderation API",
    description = "Groq Vision-powered political content moderation for the ProtoMatiks platform.",
    version     = "3.0.0",
    docs_url    = "/docs",
    redoc_url   = "/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Explicit allow-list (exact origins) plus a regex that covers every
# Vercel preview / production URL without maintenance.
_explicit_origins: list[str] = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
if FRONTEND_URL:
    _explicit_origins.append(FRONTEND_URL.rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins       = _explicit_origins,
    allow_origin_regex  = r"https://.*\.vercel\.app",  # covers all preview URLs
    allow_credentials   = True,
    allow_methods       = ["GET", "POST", "OPTIONS"],
    allow_headers       = ["*"],
)

# ─────────────────────────────────────────────────────────────────────────────
# Response schema
# ─────────────────────────────────────────────────────────────────────────────
class ModerationResult(BaseModel):
    reason_tag: str   # "political" | "none"
    is_flagged: str   # "Yes"       | "No"
    intent: Optional[str] = "None"
    flagged_items: Optional[list[str]] = []

# ─────────────────────────────────────────────────────────────────────────────
# Prompt engineering
# ─────────────────────────────────────────────────────────────────────────────
_SYSTEM_PROMPT = """
You are ProtoMatiks' zero-tolerance political content moderator. 

Your core operating principle is POSITIVE PROOF: All content is assumed SAFE by default. You may only flag content if you can extract explicit, verifiable evidence of governance, elections, state actors, or socio-political activism.

CRITICAL: ACADEMIC & TECHNICAL SAFEGUARD
Scientific data visualizations, graphs, charts, diagrams, engineering schematics, mathematical plots (e.g., Nyquist plots, Bode plots, electrochemical impedance spectroscopy (EIS) sweeps, circuitry diagrams, chemical formulas, code snippets) are 100% APOLITICAL and SAFE. Never flag them, even if they contain technical labels, engineering abbreviations, or mathematical terminology.

STEP 1: INTENT IDENTIFICATION
- Determine the primary function/purpose of the combined image and caption (e.g., "Scientific Data Visualization", "Satirical Political Mockery", "Commercial Advertising", "Personal Lifestyle", "Electoral Campaigning").

STEP 2: EVIDENCE GATHERING
- Analyze the text, imagery, and their combined context.
- Look specifically for entities involved in state governance, electoral politics, geopolitics, or political activism (e.g., politicians, government bodies, political parties, election campaigns, geopolitical conflicts).
- Do not infer political meaning from isolated dictionary words (e.g., "resistance", "charge", "party", "left", "right") unless the overall context and intent of the post actively demonstrates a socio-political intent.

STEP 3: POPULATING `flagged_items`
- If you find positive proof of political context, list the exact political entities, symbols, or contextual phrases in the `flagged_items` array.
- If no explicit political entities or socio-political contexts exist, `flagged_items` MUST remain completely empty `[]`.

STEP 4: THE FINAL VERDICT
- If `flagged_items` contains 1 or more items: Set "is_flagged" to "Yes" and "reason_tag" to "political".
- If `flagged_items` is empty `[]`: Set "is_flagged" to "No" and "reason_tag" to "none".

OUTPUT REQUIREMENTS:
Output strictly a raw JSON object with NO markdown formatting, NO backticks, and NO conversational text:
{
  "intent": "<Concise summary of post purpose>",
  "is_flagged": "Yes" or "No",
  "reason_tag": "political" or "none",
  "flagged_items": ["item1"] or []
}
"""

# ─────────────────────────────────────────────────────────────────────────────
# Groq client — lazy singleton
# ─────────────────────────────────────────────────────────────────────────────
_groq_client: Optional[Groq] = None

def _get_client() -> Groq:
    global _groq_client
    if _groq_client is None:
        if not GROQ_API_KEY:
            raise HTTPException(
                status_code=503,
                detail=(
                    "The GROQ_API_KEY environment variable is not configured on this server. "
                    "Set it in Render → Environment and redeploy."
                ),
            )
        _groq_client = Groq(api_key=GROQ_API_KEY)
        logger.info("Groq client initialised  model=%s", GROQ_MODEL)
    return _groq_client

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────
def _parse_llm_response(raw: str) -> ModerationResult:
    """
    Clean and parse JSON from the model's reply.
    Aggressively strips markdown fences (e.g. ```json ... ```) first.
    """
    cleaned = raw.strip()
    
    # Strip markdown block wrappers if present
    if cleaned.startswith("```"):
        first_newline = cleaned.find("\n")
        if first_newline != -1:
            cleaned = cleaned[first_newline:].strip()
        else:
            cleaned = cleaned[3:].strip()
            
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3].strip()

    try:
        data: dict = json.loads(cleaned)

        intent = str(data.get("intent", "None")).strip()
        flagged_items = data.get("flagged_items", [])
        if not isinstance(flagged_items, list):
            flagged_items = [str(flagged_items)]

        reason_tag_raw  = str(data.get("reason_tag", "none")).strip().lower()
        is_flagged_raw  = str(data.get("is_flagged", "No")).strip()

        reason_tag = "political" if reason_tag_raw == "political" else "none"
        is_flagged = "Yes" if is_flagged_raw.lower() in {"yes", "true", "1"} else "No"

        # Consistency guard: align fields
        if (reason_tag == "political" or len(flagged_items) > 0) and is_flagged == "No":
            is_flagged = "Yes"
            reason_tag = "political"
        if reason_tag == "none" and is_flagged == "Yes":
            reason_tag = "political"

        return ModerationResult(
            reason_tag=reason_tag,
            is_flagged=is_flagged,
            intent=intent,
            flagged_items=flagged_items
        )

    except (json.JSONDecodeError, KeyError, ValueError):
        logger.warning("JSON parse failed — falling back to keyword scan. Raw: %r, Cleaned: %r", raw, cleaned)
        lower = cleaned.lower()
        flagged = '"yes"' in lower or '"political"' in lower or "political content" in lower
        return ModerationResult(
            reason_tag = "political" if flagged else "none",
            is_flagged = "Yes"       if flagged else "No",
            intent = "Fallback analysis due to parsing error",
            flagged_items = ["potential political references (fallback scan)"] if flagged else []
        )

# ─────────────────────────────────────────────────────────────────────────────
# Health endpoints
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/", tags=["health"], summary="Root ping")
async def root():
    return {"status": "ok", "service": "ProtoMatiks Moderation API", "version": "3.0.0"}


@app.get("/health", tags=["health"], summary="Health check")
async def health():
    return {
        "status" : "healthy",
        "model"  : GROQ_MODEL,
        "api_key": "configured" if GROQ_API_KEY else "MISSING",
    }

# ─────────────────────────────────────────────────────────────────────────────
# Core moderation endpoint
# ─────────────────────────────────────────────────────────────────────────────
@app.post(
    "/moderate-post",
    response_model = ModerationResult,
    tags           = ["moderation"],
    summary        = "Analyse an image + caption for political content",
    response_description = "Strict two-field verdict: reason_tag and is_flagged",
)
async def moderate_post(
    image:   UploadFile        = File(..., description="Image to moderate (JPEG/PNG/WebP/GIF — max 20 MB)"),
    caption: Optional[str]     = Form(None, description="Optional text caption accompanying the post"),
):
    """
    Accepts an image and an optional caption via **multipart/form-data**.

    1. Validates the MIME type and file size.
    2. Encodes the image to a base64 data URI.
    3. Sends both to the AI engine with a strict JSON system prompt.
    4. Returns `{ "reason_tag": "political"|"none", "is_flagged": "Yes"|"No" }`.
    """

    # ── 1. MIME validation ────────────────────────────────────────────────────
    content_type = (image.content_type or "").lower()
    if not content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail=f"Uploaded file must be an image. Received content-type: '{content_type}'",
        )

    # ── 2. Read & size-check ──────────────────────────────────────────────────
    try:
        raw_bytes: bytes = await image.read()
    except Exception as exc:
        logger.error("Failed to read uploaded file: %s", exc)
        raise HTTPException(status_code=400, detail=f"Could not read uploaded file: {exc}") from exc

    if len(raw_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Image exceeds the 20 MB limit (received {len(raw_bytes)/1e6:.1f} MB).",
        )

    logger.info(
        "Image received  filename=%r  size=%.1f KB  mime=%s",
        image.filename, len(raw_bytes) / 1024, content_type,
    )

    # ── 3. Base64 encode ──────────────────────────────────────────────────────
    b64: str      = base64.standard_b64encode(raw_bytes).decode("utf-8")
    data_uri: str = f"data:{content_type};base64,{b64}"

    # ── 4. Build user message ─────────────────────────────────────────────────
    clean_caption = caption.strip() if caption and caption.strip() else ""
    user_text = (
        f"Caption provided by the user: {clean_caption}"
        if clean_caption
        else "No caption was provided — analyse the image only."
    )

    # ── 5. Call Groq Vision API ───────────────────────────────────────────────
    logger.info("Calling Groq model: %s …", GROQ_MODEL)
    try:
        client = _get_client()
        completion = client.chat.completions.create(
            model    = GROQ_MODEL,
            messages = [
                {
                    "role"   : "system",
                    "content": _SYSTEM_PROMPT,
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type"     : "image_url",
                            "image_url": {"url": data_uri},
                        },
                        {
                            "type": "text",
                            "text": user_text,
                        },
                    ],
                },
            ],
            temperature     = 0,        # deterministic verdicts
            max_tokens      = 128,      # allow slightly more tokens for possible formatting wrapping
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Groq API error: %s", exc)
        raise HTTPException(
            status_code = 502,
            detail      = f"Groq Vision API call failed: {exc}",
        ) from exc

    raw_response: str = (completion.choices[0].message.content or "").strip()
    logger.info("Groq raw response: %r", raw_response)

    # ── 6. Parse & return ─────────────────────────────────────────────────────
    result = _parse_llm_response(raw_response)
    logger.info(
        "Verdict  reason_tag=%r  is_flagged=%r",
        result.reason_tag, result.is_flagged,
    )
    return result
