from __future__ import annotations

from collections import deque
import json
import os
from pathlib import Path
from threading import Lock
from typing import Any

os.environ.setdefault("TF_USE_LEGACY_KERAS", "1")

import cv2
import mediapipe as mp
import numpy as np

DEFAULT_ACTIONS = np.array(["Hola", "Gracias", "Te quiero", "Nos vemos", "Como estas"])
SEQUENCE_LENGTH = 30
PREDICTION_THRESHOLD = 0.60
STABILITY_WINDOW = 4
NO_HAND_RESET_FRAMES = 10


class _ActionDetector:
    def __init__(self) -> None:
        self._lock = Lock()
        self._sequence: deque[np.ndarray] = deque(maxlen=SEQUENCE_LENGTH)
        self._prediction_indices: deque[int] = deque(maxlen=STABILITY_WINDOW)
        self._stable_label: str = "Sin sena"
        self._stable_confidence: float = 0.0
        self._no_hand_frames: int = 0
        self._actions = self._load_actions()
        self._model = self._try_load_model()

        self._holistic = None
        self._has_solutions_api = hasattr(mp, "solutions") and hasattr(mp.solutions, "holistic")
        if self._has_solutions_api:
            self._holistic = mp.solutions.holistic.Holistic(
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5,
            )

    def _reset_state(self) -> None:
        self._sequence.clear()
        self._prediction_indices.clear()
        self._stable_label = "Sin sena"
        self._stable_confidence = 0.0

    def predict(self, image_bgr: np.ndarray) -> dict[str, Any]:
        if image_bgr is None or image_bgr.size == 0:
            return {"prediction": "Sin sena", "confidence": 0.0, "engine": "none"}

        with self._lock:
            if self._has_solutions_api and self._holistic is not None:
                image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
                results = self._holistic.process(image_rgb)

                hand_visible = results.left_hand_landmarks or results.right_hand_landmarks
                if not hand_visible:
                    self._no_hand_frames += 1
                    if self._no_hand_frames >= NO_HAND_RESET_FRAMES:
                        self._reset_state()
                    return {
                        "prediction": "Sin sena",
                        "confidence": 0.0,
                        "engine": "action.h5",
                    }
                else:
                    self._no_hand_frames = 0

                keypoints = self._extract_keypoints(results)
                self._sequence.append(keypoints)

                if self._model is not None and len(self._sequence) == SEQUENCE_LENGTH:
                    probs = self._model.predict(
                        np.expand_dims(np.array(self._sequence), axis=0), verbose=0
                    )[0]
                    idx = int(np.argmax(probs))
                    confidence = float(probs[idx])
                    self._prediction_indices.append(idx)

                    if (
                        len(self._prediction_indices) == STABILITY_WINDOW
                        and len(set(self._prediction_indices)) == 1
                        and confidence >= PREDICTION_THRESHOLD
                    ):
                        if idx < len(self._actions):
                            label = str(self._actions[idx])
                        else:
                            label = self._stable_label
                        self._stable_label = label
                        self._stable_confidence = confidence

                    return {
                        "prediction": self._stable_label,
                        "confidence": round(self._stable_confidence, 3),
                        "engine": "action.h5",
                    }

                fallback_label, fallback_conf = self._fallback_landmark_rule(results)
                self._stable_label = fallback_label
                self._stable_confidence = fallback_conf
                return {
                    "prediction": fallback_label,
                    "confidence": round(fallback_conf, 3),
                    "engine": "mediapipe-landmarks-fallback",
                }

            fallback_label, fallback_conf = self._fallback_contour_rule(image_bgr)
            self._stable_label = fallback_label
            self._stable_confidence = fallback_conf
            return {
                "prediction": fallback_label,
                "confidence": round(fallback_conf, 3),
                "engine": "opencv-contour-fallback",
            }

    @staticmethod
    def _extract_keypoints(results: Any) -> np.ndarray:
        # Solo manos: 2 × 21 landmarks × 3 coordenadas = 126 features
        left_hand = (
            np.array([[lm.x, lm.y, lm.z] for lm in results.left_hand_landmarks.landmark]).flatten()
            if results.left_hand_landmarks
            else np.zeros(21 * 3)
        )
        right_hand = (
            np.array([[lm.x, lm.y, lm.z] for lm in results.right_hand_landmarks.landmark]).flatten()
            if results.right_hand_landmarks
            else np.zeros(21 * 3)
        )
        return np.concatenate([left_hand, right_hand]).astype(np.float32)

    @staticmethod
    def _finger_state(hand_landmarks: Any) -> dict[str, bool]:
        lm = hand_landmarks.landmark

        wrist = lm[0]
        thumb_tip, thumb_ip, thumb_mcp = lm[4], lm[3], lm[2]
        index_tip, index_pip = lm[8], lm[6]
        middle_tip, middle_pip = lm[12], lm[10]
        ring_tip, ring_pip = lm[16], lm[14]
        pinky_tip, pinky_pip = lm[20], lm[18]

        index_up = index_tip.y < index_pip.y
        middle_up = middle_tip.y < middle_pip.y
        ring_up = ring_tip.y < ring_pip.y
        pinky_up = pinky_tip.y < pinky_pip.y
        thumb_up = abs(thumb_tip.x - thumb_ip.x) > abs(thumb_mcp.x - wrist.x) * 0.3

        return {
            "thumb": thumb_up,
            "index": index_up,
            "middle": middle_up,
            "ring": ring_up,
            "pinky": pinky_up,
        }

    def _fallback_landmark_rule(self, results: Any) -> tuple[str, float]:
        hand = results.right_hand_landmarks or results.left_hand_landmarks
        if not hand:
            return "Sin sena", 0.0

        fingers = self._finger_state(hand)
        extended_count = sum(int(v) for v in fingers.values())

        # Te quiero: pulgar + índice + meñique extendidos
        if fingers["thumb"] and fingers["index"] and fingers["pinky"] and not fingers["middle"] and not fingers["ring"]:
            return "Te quiero", 0.70

        # Nos vemos: índice + meñique extendidos (cuernos)
        if fingers["index"] and fingers["pinky"] and not fingers["thumb"] and not fingers["middle"] and not fingers["ring"]:
            return "Nos vemos", 0.60

        # Como estas: índice + medio extendidos (dedos en V)
        if fingers["index"] and fingers["middle"] and not fingers["thumb"] and not fingers["ring"] and not fingers["pinky"]:
            return "Como estas", 0.65

        # Hola: mano abierta (4+ dedos)
        if extended_count >= 4:
            return "Hola", 0.80

        # Gracias: mano cerrada (1 o menos dedos)
        if extended_count <= 1:
            return "Gracias", 0.65

        return self._stable_label, max(self._stable_confidence * 0.9, 0.25)

    def _fallback_contour_rule(self, image_bgr: np.ndarray) -> tuple[str, float]:
        gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
        blur = cv2.GaussianBlur(gray, (7, 7), 0)
        _, thresh = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        if np.mean(thresh) > 127:
            thresh = cv2.bitwise_not(thresh)

        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return "Sin sena", 0.0

        largest = max(contours, key=cv2.contourArea)
        area = cv2.contourArea(largest)
        if area < 4000:
            return "Sin sena", 0.1

        hull = cv2.convexHull(largest, returnPoints=False)
        if hull is None or len(hull) < 3:
            return self._stable_label, max(self._stable_confidence * 0.8, 0.2)

        defects = cv2.convexityDefects(largest, hull)
        finger_gaps = 0
        if defects is not None:
            for i in range(defects.shape[0]):
                s, e, f, d = defects[i, 0]
                start = largest[s][0]
                end = largest[e][0]
                far = largest[f][0]
                a = np.linalg.norm(start - end)
                b = np.linalg.norm(start - far)
                c = np.linalg.norm(end - far)
                if b * c == 0:
                    continue
                angle = np.degrees(np.arccos((b * b + c * c - a * a) / (2 * b * c)))
                if angle <= 90 and d > 8000:
                    finger_gaps += 1

        estimated_fingers = min(5, finger_gaps + 1)
        if estimated_fingers >= 4:
            return "Hola", 0.78
        if estimated_fingers == 3:
            return "Te quiero", 0.72
        if estimated_fingers == 2:
            return "Nos vemos", 0.70
        if estimated_fingers <= 1:
            return "Gracias", 0.70

        return self._stable_label, max(self._stable_confidence * 0.9, 0.3)

    @staticmethod
    def _try_load_model() -> Any | None:
        try:
            os.environ.setdefault("TF_USE_LEGACY_KERAS", "1")
            from tensorflow.keras.models import load_model  # type: ignore
        except Exception:
            return None

        base = Path(__file__).resolve().parents[1]
        candidates = [
            base / "external" / "ActionDetectionforSignLanguage" / "action.h5",
            base / "action.h5",
        ]
        for candidate in candidates:
            if candidate.exists():
                try:
                    return load_model(str(candidate))
                except Exception:
                    continue
        return None

    @staticmethod
    def _load_actions() -> np.ndarray:
        base = Path(__file__).resolve().parents[1]
        labels_file = base / "external" / "ActionDetectionforSignLanguage" / "action_labels.json"
        if labels_file.exists():
            try:
                labels = json.loads(labels_file.read_text(encoding="utf-8"))
                if isinstance(labels, list) and labels:
                    return np.array([str(label) for label in labels])
            except Exception:
                pass
        return DEFAULT_ACTIONS


_DETECTOR = _ActionDetector()


def predict_gesture(image: np.ndarray) -> dict[str, Any]:
    return _DETECTOR.predict(image)