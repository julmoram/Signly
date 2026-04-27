from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import Response
from pydantic import BaseModel
import numpy as np
import cv2
import io
import math
import struct
import wave
from pathlib import Path
from datetime import datetime
import re
import unicodedata
from model.predict import predict_gesture

router = APIRouter()

@router.post("/predict")
async def predict(file: UploadFile = File(...)):
    contents = await file.read()

    np_array = np.frombuffer(contents, np.uint8)
    image = cv2.imdecode(np_array, cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="Invalid image payload")

    result = predict_gesture(image)

    return {
        "prediction": result.get("prediction", "Sin seña"),
        "confidence": result.get("confidence"),
        "engine": result.get("engine"),
    }


class TTSRequest(BaseModel):
    text: str
    speed: float = 1.0


@router.post("/tts")
async def tts(payload: TTSRequest):
    text = (payload.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")

    wav_bytes = _generate_tone_wav(duration_s=min(3.0, max(0.5, len(text) * 0.06)))
    return Response(content=wav_bytes, media_type="audio/wav")


@router.post("/teach")
async def teach(
    file: UploadFile = File(...),
    label: str = Form(...),
):
    clean_label = _sanitize_label(label)
    if not clean_label:
        raise HTTPException(status_code=400, detail="label is required")

    contents = await file.read()
    np_array = np.frombuffer(contents, np.uint8)
    image = cv2.imdecode(np_array, cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="Invalid image payload")

    dataset_dir = Path("datasets") / "manual" / clean_label
    dataset_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
    filename = f"{timestamp}.jpg"
    filepath = dataset_dir / filename
    saved = cv2.imwrite(str(filepath), image)
    if not saved:
        raise HTTPException(status_code=500, detail="Could not save sample")

    count = len(list(dataset_dir.glob("*.jpg")))
    return {
        "ok": True,
        "label": clean_label,
        "count": count,
        "path": str(filepath),
    }


def _generate_tone_wav(duration_s: float, sample_rate: int = 22050) -> bytes:
    frame_count = int(duration_s * sample_rate)
    amplitude = 9000
    frequency = 440.0

    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)

        for n in range(frame_count):
            sample = int(amplitude * math.sin(2.0 * math.pi * frequency * (n / sample_rate)))
            wav_file.writeframesraw(struct.pack("<h", sample))

    return buffer.getvalue()


def _sanitize_label(raw: str) -> str:
    text = (raw or "").strip().lower()
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    # Keep alphanumeric and spaces; convert spaces to underscores.
    text = re.sub(r"[^a-z0-9 ]+", "", text)
    text = re.sub(r"\s+", "_", text)
    return text[:50]
