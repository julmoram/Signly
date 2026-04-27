from __future__ import annotations

import argparse
import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

os.environ.setdefault("TF_USE_LEGACY_KERAS", "1")

import cv2
import mediapipe as mp
import numpy as np
from tensorflow.keras.callbacks import EarlyStopping
from tensorflow.keras.layers import Dense, LSTM
from tensorflow.keras.models import Sequential
from tensorflow.keras.utils import to_categorical

KEYPOINT_SIZE = 126


@dataclass
class SequenceItem:
    label: str
    sequence: np.ndarray  # shape: (sequence_length, 1662)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Entrena LSTM desde datasets/manual")
    parser.add_argument(
        "--dataset",
        type=Path,
        default=Path("datasets/manual"),
        help="Directorio con subcarpetas por etiqueta",
    )
    parser.add_argument(
        "--sequence-length",
        type=int,
        default=30,
        help="Frames por secuencia",
    )
    parser.add_argument(
        "--epochs",
        type=int,
        default=40,
        help="Numero de epocas",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=16,
        help="Tamano de batch",
    )
    parser.add_argument(
        "--train-ratio",
        type=float,
        default=0.8,
        help="Porcentaje train/val (0.0-1.0)",
    )
    parser.add_argument(
        "--output-model",
        type=Path,
        default=Path("external/ActionDetectionforSignLanguage/action.h5"),
        help="Ruta salida del modelo .h5",
    )
    parser.add_argument(
        "--output-labels",
        type=Path,
        default=Path("external/ActionDetectionforSignLanguage/action_labels.json"),
        help="Ruta salida etiquetas json",
    )
    parser.add_argument(
        "--min-sequences-per-label",
        type=int,
        default=2,
        help="Minimo de secuencias por etiqueta para entrenar",
    )
    return parser.parse_args()


def extract_keypoints(results) -> np.ndarray:
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

def list_images(label_dir: Path) -> list[Path]:
    exts = {".jpg", ".jpeg", ".png"}
    files = [p for p in label_dir.iterdir() if p.is_file() and p.suffix.lower() in exts]
    return sorted(files, key=lambda p: p.name)


def chunked(items: list[Path], size: int) -> Iterable[list[Path]]:
    for i in range(0, len(items), size):
        chunk = items[i : i + size]
        if len(chunk) == size:
            yield chunk


def build_sequences(dataset_dir: Path, sequence_length: int) -> tuple[list[str], list[SequenceItem]]:
    if not dataset_dir.exists():
        raise FileNotFoundError(f"No existe dataset: {dataset_dir}")

    label_dirs = [p for p in dataset_dir.iterdir() if p.is_dir()]
    labels = sorted([p.name for p in label_dirs])
    if not labels:
        raise RuntimeError(f"No hay etiquetas en {dataset_dir}")

    sequence_items: list[SequenceItem] = []
    holistic = mp.solutions.holistic.Holistic(
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    )

    try:
        for label in labels:
            label_path = dataset_dir / label
            image_files = list_images(label_path)
            for window in chunked(image_files, sequence_length):
                frames = []
                for image_path in window:
                    image = cv2.imread(str(image_path))
                    if image is None:
                        raise RuntimeError(f"No se pudo leer imagen: {image_path}")
                    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                    results = holistic.process(image_rgb)
                    frames.append(extract_keypoints(results))
                sequence_items.append(SequenceItem(label=label, sequence=np.array(frames, dtype=np.float32)))
    finally:
        holistic.close()

    return labels, sequence_items


def split_train_val(items: list[SequenceItem], label_to_index: dict[str, int], train_ratio: float):
    per_label: dict[str, list[SequenceItem]] = {}
    for item in items:
        per_label.setdefault(item.label, []).append(item)

    train_items: list[SequenceItem] = []
    val_items: list[SequenceItem] = []
    rng = np.random.default_rng(42)

    for label, values in per_label.items():
        idx = np.arange(len(values))
        rng.shuffle(idx)
        shuffled = [values[i] for i in idx]
        split = int(len(shuffled) * train_ratio)
        split = min(max(split, 1), len(shuffled) - 1) if len(shuffled) > 1 else 1
        train_items.extend(shuffled[:split])
        if len(shuffled) > 1:
            val_items.extend(shuffled[split:])

    def to_xy(rows: list[SequenceItem]):
        x = np.array([row.sequence for row in rows], dtype=np.float32)
        y_idx = np.array([label_to_index[row.label] for row in rows], dtype=np.int32)
        return x, y_idx

    x_train, y_train_idx = to_xy(train_items)
    x_val, y_val_idx = to_xy(val_items) if val_items else (np.array([]), np.array([]))
    return x_train, y_train_idx, x_val, y_val_idx


def build_model(sequence_length: int, num_classes: int) -> Sequential:
    model = Sequential()
    model.add(LSTM(64, return_sequences=True, activation="relu", input_shape=(sequence_length, KEYPOINT_SIZE)))
    model.add(LSTM(128, return_sequences=True, activation="relu"))
    model.add(LSTM(64, return_sequences=False, activation="relu"))
    model.add(Dense(64, activation="relu"))
    model.add(Dense(32, activation="relu"))
    model.add(Dense(num_classes, activation="softmax"))
    model.compile(optimizer="Adam", loss="categorical_crossentropy", metrics=["categorical_accuracy"])
    return model


def main() -> None:
    args = parse_args()
    labels, items = build_sequences(args.dataset, args.sequence_length)

    counts = {label: 0 for label in labels}
    for item in items:
        counts[item.label] += 1

    non_empty_labels = [label for label in labels if counts[label] > 0]
    dropped = [label for label in labels if counts[label] == 0]
    if dropped:
        print("Etiquetas ignoradas por falta de secuencias completas:")
        for label in dropped:
            print(f"- {label} (0 secuencias)")

    labels = non_empty_labels
    items = [item for item in items if item.label in set(labels)]
    if not labels:
        raise RuntimeError("No hay secuencias validas para entrenar")

    label_to_index = {label: i for i, label in enumerate(labels)}

    print("Resumen de secuencias por etiqueta:")
    for label in labels:
        print(f"- {label}: {counts[label]} secuencias")

    too_small = [label for label in labels if counts[label] < args.min_sequences_per_label]
    if too_small:
        joined = ", ".join(too_small)
        raise RuntimeError(
            f"Etiquetas con pocas secuencias (min {args.min_sequences_per_label}): {joined}"
        )

    x_train, y_train_idx, x_val, y_val_idx = split_train_val(items, label_to_index, args.train_ratio)
    y_train = to_categorical(y_train_idx).astype(np.float32)
    y_val = to_categorical(y_val_idx).astype(np.float32) if y_val_idx.size else None

    model = build_model(args.sequence_length, len(labels))

    callbacks = [
        EarlyStopping(
            monitor="val_categorical_accuracy" if y_val is not None else "categorical_accuracy",
            patience=8,
            restore_best_weights=True,
            mode="max",
        )
    ]

    fit_kwargs = {
        "x": x_train,
        "y": y_train,
        "epochs": args.epochs,
        "batch_size": args.batch_size,
        "verbose": 1,
        "callbacks": callbacks,
    }
    if y_val is not None and x_val.size:
        fit_kwargs["validation_data"] = (x_val, y_val)

    history = model.fit(**fit_kwargs)
    final_acc = history.history.get("categorical_accuracy", [0])[-1]
    print(f"Entrenamiento finalizado. Accuracy train: {final_acc:.4f}")

    args.output_model.parent.mkdir(parents=True, exist_ok=True)
    args.output_labels.parent.mkdir(parents=True, exist_ok=True)
    model.save(str(args.output_model))
    args.output_labels.write_text(json.dumps(labels, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Modelo guardado en: {args.output_model}")
    print(f"Etiquetas guardadas en: {args.output_labels}")


if __name__ == "__main__":
    main()
