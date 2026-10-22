# Real-Time Traffic & Pedestrian Monitoring System (YOLOv8 + OpenCV)

An enterprise-grade computer vision and intelligent surveillance pipeline for urban traffic analysis, automated vehicle/pedestrian detection, multi-object tracking, and directional gate crossing telemetry.

Developed for **Assignment 2: Real-Time Traffic & Pedestrian Monitoring (Object Detection)**.

---

## 🎯 Deliverables Checklist

| Deliverable | Description | Implementation File | Status |
| :--- | :--- | :--- | :--- |
| **1. Frame-by-Frame Detection** | Detects & tracks vehicles (cars, buses, trucks, motorcycles), pedestrians, and cyclists with bounding boxes & confidence scores | [`src/detector.py`](file:///c:/daidai/src/detector.py), [`traffic_monitor.py`](file:///c:/daidai/traffic_monitor.py) | **Complete** ✅ |
| **2. Trajectory-Based Counting** | Anti-duplication line crossing & ROI zone occupancy algorithm logging directional flow (IN/OUT) | [`src/counter.py`](file:///c:/daidai/src/counter.py), [`src/logger.py`](file:///c:/daidai/src/logger.py) | **Complete** ✅ |
| **3. Annotated Surveillance Video** | Output video with bounding boxes, confidence badges, motion trails, active crossing alerts, and real-time HUD telemetry | [`outputs/annotated_traffic_monitoring.mp4`](file:///c:/daidai/outputs/annotated_traffic_monitoring.mp4) | **Complete** ✅ |
| **4. Inference Speed vs Model Size Analysis** | Formal benchmark profiling **YOLOv8n vs YOLOv8s vs YOLOv8m** with FPS, latency breakdown, parameter count, and publication charts | [`benchmark_models.py`](file:///c:/daidai/benchmark_models.py), [`outputs/fps_vs_modelsize.png`](file:///c:/daidai/outputs/fps_vs_modelsize.png) | **Complete** ✅ |
| **5. Interactive Web Dashboard** | Streamlit web application with live video processing, parameter tuning, telemetry charts, and CSV data export | [`app.py`](file:///c:/daidai/app.py) | **Complete** ✅ |

---

## 🏗️ System Architecture

```
                                 [ Video Feed / Camera ]
                                            │
                                            ▼
                          ┌───────────────────────────────────┐
                          │   Frame Acquisition & Resizing    │
                          │        (OpenCV VideoCapture)      │
                          └─────────────────┬─────────────────┘
                                            │
                                            ▼
                          ┌───────────────────────────────────┐
                          │    YOLOv8 Deep Feature Extractor  │
                          │   (ConvNeXt / C2f Backbone + PAN) │
                          └─────────────────┬─────────────────┘
                                            │
                                            ▼
                          ┌───────────────────────────────────┐
                          │   Multi-Object Tracking Engine    │
                          │  (BYTETracker: Kalman Filter +    │
                          │   Hungarian Association Matrix)   │
                          └─────────────────┬─────────────────┘
                                            │
                                            ▼
                          ┌───────────────────────────────────┐
                          │ Trajectory & Gate Crossing Counter│
                          │  - Vector Intersection Test       │
                          │  - Anti-duplication by Track ID   │
                          │  - Direction Vector (IN / OUT)    │
                          └────────┬─────────────────┬────────┘
                                   │                 │
                ┌──────────────────┘                 └──────────────────┐
                ▼                                                       ▼
  ┌───────────────────────────┐                           ┌───────────────────────────┐
  │  Surveillance HUD Overlay │                           │ Telemetry Event Logger    │
  │  - Glassmorphic Banner    │                           │ - traffic_counts_log.csv  │
  │  - Color-Coded Boxes      │                           │ - telemetry_summary.json  │
  │  - Centroid Motion Trails │                           └───────────────────────────┘
  │  - Dynamic Gate Flash     │
  └─────────────┬─────────────┘
                │
                ▼
  [ Annotated MP4 Output Feed ]
```

---

## ⚡ Benchmark Results: Speed (FPS) vs Model Size

Benchmarked across 60 evaluation frames under identical hardware and input conditions:

| Model Architecture | Model Size (MB) | Parameters (M) | Pre-Process (ms) | Inference (ms) | Post-Process (ms) | Total Latency (ms) | Throughput (FPS) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **YOLOv8n (Nano)** | **6.25 MB** | **3.16 M** | 4.19 ms | 123.25 ms | 1.45 ms | **128.88 ms** | **7.76 FPS** |
| **YOLOv8s (Small)** | **21.54 MB** | **11.17 M** | 3.02 ms | 184.61 ms | 1.04 ms | **188.67 ms** | **5.30 FPS** |
| **YOLOv8m (Medium)** | **49.72 MB** | **25.90 M** | 4.14 ms | 505.83 ms | 1.71 ms | **511.68 ms** | **1.95 FPS** |

### Key Observations:
1. **YOLOv8n (Nano)** achieves **4.0x faster inference** than YOLOv8m while requiring only **12.5% of the storage space** (6.25 MB vs 49.72 MB), making it ideal for edge devices, embedded cameras, and resource-constrained surveillance nodes.
2. **YOLOv8m (Medium)** excels at resolving small, distant pedestrians and occluded vehicles in complex urban intersections, but its forward latency (505 ms on CPU) requires dedicated hardware accelerators (NVIDIA GPU / TensorRT) for real-time operation.
3. The neural network forward pass accounts for **>95% of total latency**, whereas preprocessing and NMS postprocessing consume less than 5%.

---

## 🚀 Quickstart Guide

### 1. Run Main Video Monitoring Script
Process the surveillance video and generate the annotated output video:
```bash
python traffic_monitor.py --source data/traffic_sample.mp4 --model yolov8n.pt --conf 0.25 --output outputs/annotated_traffic_monitoring.mp4
```

### 2. Run Model Benchmark Analysis
Profile YOLOv8n vs YOLOv8s vs YOLOv8m and generate comparison graphs:
```bash
python benchmark_models.py
```

### 3. Launch Interactive Streamlit Dashboard
Launch the interactive web UI with real-time video playback and charts:
```bash
streamlit run app.py
```

---

## 📊 File Manifest

- [`traffic_monitor.py`](file:///c:/daidai/traffic_monitor.py): Command-line pipeline script for video processing.
- [`benchmark_models.py`](file:///c:/daidai/benchmark_models.py): Inference speed vs model size profiling suite.
- [`app.py`](file:///c:/daidai/app.py): Interactive Streamlit surveillance dashboard.
- [`src/detector.py`](file:///c:/daidai/src/detector.py): YOLOv8 object detector and class filter.
- [`src/counter.py`](file:///c:/daidai/src/counter.py): Directional line crossing and ROI occupancy engine.
- [`src/visualizer.py`](file:///c:/daidai/src/visualizer.py): Professional surveillance HUD overlay and visual styling.
- [`src/logger.py`](file:///c:/daidai/src/logger.py): Structured CSV event logger and telemetry summary exporter.
- [`outputs/`](file:///c:/daidai/outputs): Directory containing annotated videos, logs, and benchmark charts.
- [`ASSIGNMENT_REPORT.md`](file:///c:/daidai/ASSIGNMENT_REPORT.md): Formal technical report submitted for evaluation.
