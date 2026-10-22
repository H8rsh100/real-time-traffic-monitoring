#!/usr/bin/env python3
"""
Benchmark Analysis: YOLOv8n vs YOLOv8s vs YOLOv8m.
Student Deliverable 4:
- Comprehensive performance profiling measuring inference speed (FPS) vs model size and parameter count.
- Detailed latency breakdown (preprocess, neural network forward pass, postprocess NMS).
- Detection quality and sensitivity metrics across model tiers.
- High-resolution visualization charts generated and saved to disk.
"""

import json
import os
import time
from typing import Dict, List
import cv2
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from ultralytics import YOLO

# Set clean aesthetic plot style
plt.style.use("seaborn-v0_8-whitegrid" if "seaborn-v0_8-whitegrid" in plt.style.available else "default")
plt.rcParams["font.family"] = "sans-serif"
plt.rcParams["font.size"] = 10


def benchmark_model(
    model_name: str,
    model_path: str,
    frames: List[np.ndarray],
    warmup_frames: int = 5,
    conf_threshold: float = 0.35,
) -> Dict:
    """
    Profile a single YOLO model over an identical list of frames.
    """
    print(f"\n[Benchmarking] Model: {model_name} ({model_path})...")
    file_size_mb = os.path.getsize(model_path) / (1024 * 1024)

    model = YOLO(model_path)

    # Count parameters
    total_params = sum(p.numel() for p in model.model.parameters()) / 1e6

    # Warmup
    print(f"  -> Warming up with {warmup_frames} frames...")
    for i in range(min(warmup_frames, len(frames))):
        _ = model.predict(frames[i], conf=conf_threshold, verbose=False)

    # Timed run
    preprocess_times = []
    inference_times = []
    postprocess_times = []
    total_detections = 0
    confidences = []

    print(f"  -> Profiling {len(frames)} evaluation frames...")
    for frame in frames:
        t_start = time.perf_counter()
        results = model.predict(frame, conf=conf_threshold, verbose=False)[0]
        t_end = time.perf_counter()

        sp = results.speed
        preprocess_times.append(sp.get("preprocess", 0.0))
        inference_times.append(sp.get("inference", 0.0))
        postprocess_times.append(sp.get("postprocess", 0.0))

        boxes = results.boxes
        if boxes is not None and len(boxes) > 0:
            total_detections += len(boxes)
            confidences.extend(boxes.conf.cpu().numpy().tolist())

    mean_preprocess = float(np.mean(preprocess_times))
    mean_inference = float(np.mean(inference_times))
    mean_postprocess = float(np.mean(postprocess_times))
    mean_total_latency = mean_preprocess + mean_inference + mean_postprocess
    throughput_fps = 1000.0 / mean_total_latency if mean_total_latency > 0 else 0.0

    mean_confidence = float(np.mean(confidences)) if confidences else 0.0

    stats = {
        "model_name": model_name,
        "weights_file": model_path,
        "model_size_mb": round(file_size_mb, 2),
        "parameters_m": round(total_params, 2),
        "mean_preprocess_ms": round(mean_preprocess, 2),
        "mean_inference_ms": round(mean_inference, 2),
        "mean_postprocess_ms": round(mean_postprocess, 2),
        "mean_total_latency_ms": round(mean_total_latency, 2),
        "throughput_fps": round(throughput_fps, 2),
        "total_detections": total_detections,
        "mean_confidence": round(mean_confidence, 3),
    }

    print(f"  -> Results for {model_name}:")
    print(f"     Size: {stats['model_size_mb']} MB | Params: {stats['parameters_m']} M")
    print(f"     Inference: {stats['mean_inference_ms']} ms | Total Latency: {stats['mean_total_latency_ms']} ms")
    print(f"     Throughput: {stats['throughput_fps']} FPS | Detections: {stats['total_detections']}")

    return stats


def generate_benchmark_visualizations(results: List[Dict], output_dir: str = "outputs"):
    """
    Produce academic, high-resolution comparison charts.
    """
    os.makedirs(output_dir, exist_ok=True)
    df = pd.DataFrame(results)

    # -------------------------------------------------------------
    # Figure 1: Inference Speed (FPS) vs Model Size & Parameter Count
    # -------------------------------------------------------------
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(13, 5), dpi=150)

    # Left: FPS vs Model Size (MB)
    colors = ["#2ecc71", "#3498db", "#e74c3c"]
    bars = ax1.bar(df["model_name"], df["throughput_fps"], color=colors, width=0.55, edgecolor="#333", alpha=0.9)
    ax1.set_title("Throughput Comparison (FPS)", fontsize=13, fontweight="bold", pad=12)
    ax1.set_ylabel("Inference Speed (FPS)", fontsize=11)
    ax1.set_xlabel("Model Architecture", fontsize=11)
    ax1.grid(axis="y", linestyle="--", alpha=0.6)

    # Add data labels on top of bars
    for bar, fps, size in zip(bars, df["throughput_fps"], df["model_size_mb"]):
        h = bar.get_height()
        ax1.annotate(
            f"{fps:.1f} FPS\n({size:.1f} MB)",
            xy=(bar.get_x() + bar.get_width() / 2, h),
            xytext=(0, 4),
            textcoords="offset points",
            ha="center",
            va="bottom",
            fontsize=10,
            fontweight="bold",
        )

    # Right: Tradeoff Scatter Plot (Size vs Latency vs FPS)
    scatter = ax2.scatter(
        df["model_size_mb"],
        df["mean_total_latency_ms"],
        s=df["parameters_m"] * 30 + 100,
        c=df["throughput_fps"],
        cmap="viridis_r",
        edgecolors="black",
        linewidth=1.5,
        alpha=0.9,
    )
    cbar = plt.colorbar(scatter, ax=ax2)
    cbar.set_label("Throughput (FPS)", fontsize=10)

    for i, row in df.iterrows():
        ax2.annotate(
            f" {row['model_name']}\n ({row['parameters_m']}M params)",
            (row["model_size_mb"], row["mean_total_latency_ms"]),
            textcoords="offset points",
            xytext=(10, -5),
            fontsize=10,
            fontweight="bold",
        )

    ax2.set_title("Latency vs Model Size (Bubble = Parameters)", fontsize=13, fontweight="bold", pad=12)
    ax2.set_xlabel("Model Disk Size (MB)", fontsize=11)
    ax2.set_ylabel("Total Latency per Frame (ms)", fontsize=11)
    ax2.grid(True, linestyle="--", alpha=0.6)

    plt.tight_layout()
    chart1_path = os.path.join(output_dir, "fps_vs_modelsize.png")
    plt.savefig(chart1_path, dpi=200, bbox_inches="tight")
    plt.close()
    print(f"[Benchmark Plots] Saved FPS vs Model Size chart to: {chart1_path}")

    # -------------------------------------------------------------
    # Figure 2: Latency Breakdown (Preprocess, Inference, Postprocess)
    # -------------------------------------------------------------
    fig, ax = plt.subplots(figsize=(9, 5), dpi=150)

    models = df["model_name"]
    prep = df["mean_preprocess_ms"]
    infer = df["mean_inference_ms"]
    post = df["mean_postprocess_ms"]

    width = 0.45
    p1 = ax.bar(models, prep, width, label="Pre-process (Resize/Normalize)", color="#3498db", edgecolor="#333")
    p2 = ax.bar(models, infer, width, bottom=prep, label="Neural Network Forward Pass", color="#e67e22", edgecolor="#333")
    p3 = ax.bar(models, post, width, bottom=prep + infer, label="Post-process (NMS / Box Decode)", color="#9b59b6", edgecolor="#333")

    ax.set_title("Latency Breakdown by Processing Stage (ms)", fontsize=13, fontweight="bold", pad=12)
    ax.set_ylabel("Latency (milliseconds)", fontsize=11)
    ax.set_xlabel("Model Architecture", fontsize=11)
    ax.legend(loc="upper left", frameon=True)
    ax.grid(axis="y", linestyle="--", alpha=0.6)

    # Label total latency on top
    for i, total in enumerate(df["mean_total_latency_ms"]):
        ax.annotate(
            f"{total:.1f} ms",
            xy=(i, total),
            xytext=(0, 4),
            textcoords="offset points",
            ha="center",
            va="bottom",
            fontsize=10,
            fontweight="bold",
        )

    plt.tight_layout()
    chart2_path = os.path.join(output_dir, "latency_breakdown.png")
    plt.savefig(chart2_path, dpi=200, bbox_inches="tight")
    plt.close()
    print(f"[Benchmark Plots] Saved Latency Breakdown chart to: {chart2_path}")


def run_benchmark(
    video_path: str = "data/car_detection.mp4",
    num_eval_frames: int = 60,
    output_dir: str = "outputs",
):
    """
    Main benchmark runner.
    """
    print(f"\n=======================================================")
    print(f"      YOLOv8 MODEL BENCHMARK & SPEED ANALYSIS          ")
    print(f"=======================================================")
    print(f" Source Video: {video_path}")
    print(f" Eval Frames : {num_eval_frames}")
    print(f" Output Dir  : {output_dir}")
    print(f"=======================================================\n")

    # Load frames into memory to isolate pipeline I/O from inference speed
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {video_path}")

    frames = []
    while len(frames) < num_eval_frames:
        ret, frame = cap.read()
        if not ret:
            break
        frames.append(frame)
    cap.release()

    print(f"[Dataset] Successfully loaded {len(frames)} benchmark frames into memory.")

    models_to_test = [
        ("YOLOv8n (Nano)", "yolov8n.pt"),
        ("YOLOv8s (Small)", "yolov8s.pt"),
        ("YOLOv8m (Medium)", "yolov8m.pt"),
    ]

    all_results = []
    for name, path in models_to_test:
        res = benchmark_model(name, path, frames)
        all_results.append(res)

    # Save structured results
    json_path = os.path.join(output_dir, "benchmark_summary.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(all_results, f, indent=4)

    csv_path = os.path.join(output_dir, "benchmark_results.csv")
    pd.DataFrame(all_results).to_csv(csv_path, index=False)

    print(f"\n[Artifacts] Benchmark JSON saved to: {json_path}")
    print(f"[Artifacts] Benchmark CSV saved to: {csv_path}")

    # Generate visual charts
    generate_benchmark_visualizations(all_results, output_dir=output_dir)

    # Print markdown table
    print("\n" + "=" * 65)
    print("                 BENCHMARK SUMMARY TABLE                 ")
    print("=" * 65)
    df_summary = pd.DataFrame(all_results)[[
        "model_name", "model_size_mb", "parameters_m", "mean_inference_ms", "mean_total_latency_ms", "throughput_fps", "total_detections"
    ]]
    print(df_summary.to_markdown(index=False))
    print("=" * 65 + "\n")

    return all_results


if __name__ == "__main__":
    run_benchmark(video_path="data/car_detection.mp4", num_eval_frames=60)
