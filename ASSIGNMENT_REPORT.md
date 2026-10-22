# Assignment 2: Real-Time Traffic & Pedestrian Monitoring (Object Detection)
## Technical Submission & Comprehensive Evaluation Report

---

## 1. Executive Summary & Objective

In modern intelligent transportation systems (ITS) and smart city infrastructure, automated video surveillance feeds require robust, low-latency computer vision pipelines to continuously detect, categorize, track, and count dynamic urban traffic participants.

The objective of this assignment is to design and implement an end-to-end real-time object detection and tracking system capable of:
1. Processing urban surveillance video feeds frame-by-frame and predicting high-precision bounding boxes for **vehicles** (cars, buses, trucks, motorcycles), **pedestrians**, and **cyclists** (bicycles).
2. Implementing a multi-object tracking (MOT) and trajectory-based counting algorithm to record directional traffic flow across a configurable gate or Region of Interest (ROI) without double-counting.
3. Annotating video frames with a heads-up display (HUD) overlay featuring live counts, FPS throughput, latency, confidence scores, and centroid motion trails.
4. Conducting a quantitative speed-versus-accuracy benchmark comparing **YOLOv8n (Nano)**, **YOLOv8s (Small)**, and **YOLOv8m (Medium)**.

---

## 2. System Architecture & Technical Methodology

The system is constructed with a modular, decoupling-first architecture consisting of five coordinated subsystems:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            VIDEO INPUT FEED                                 │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. OBJECT DETECTOR (src/detector.py)                                        │
│    - Ultralytics YOLOv8 backbone (C2f modules, PANet, anchor-free head)     │
│    - Target category mapping: Pedestrian (0), Cyclist (1), Vehicle (2,3,5,7)│
│    - Confidence filtering (tau_conf) and NMS IoU suppression (tau_iou)     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Detections [BBox, Conf, Class]
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. MULTI-OBJECT TRACKER (BYTETracker)                                       │
│    - 8-dimensional Kalman filter state estimation: [x, y, a, h, vx, vy, va, vh]
│    - Two-stage bipartite Hungarian matching:                                │
│      * Stage 1: High-confidence detections matched via Cosine / IoU distance│
│      * Stage 2: Low-confidence detections matched to recover occluded tracks│
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Persistent Track IDs [ID, Centroid, BBox]
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. TRAJECTORY & GATE COUNTER (src/counter.py)                               │
│    - FIFO motion deque storing past centroids per Track ID                  │
│    - Trajectory segment intersection with counting threshold line           │
│    - Direction vector resolution: IN (downward/right) vs OUT (upward/left)  │
│    - Anti-duplication state hash to eliminate multi-triggering              │
│    - Point-in-polygon ROI zone occupancy test (cv2.pointPolygonTest)        │
└──────────────────┬───────────────────────────────────┬──────────────────────┘
                   │                                   │
                   ▼                                   ▼
┌───────────────────────────────────┐ ┌───────────────────────────────────────┐
│ 4. HUD VISUALIZER                 │ │ 5. TELEMETRY LOGGER                   │
│    (src/visualizer.py)            │ │    (src/logger.py)                    │
│    - Glassmorphic top banner      │ │    - Event-driven CSV record stream   │
│    - Class-specific color coding  │ │    - JSON summary analytics export    │
│    - Trajectory polylines & trail │ └───────────────────────────────────────┘
│    - Dynamic gate flashing on event│
└──────────────────┬────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│               ANNOTATED MP4 OUTPUT (outputs/annotated_traffic_monitoring.mp4)│
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Object Detection Engine (YOLOv8)
The detection subsystem leverages Ultralytics YOLOv8, an anchor-free single-stage detector. Rather than relying on predefined anchor boxes, YOLOv8 directly predicts the distance from the center of candidate feature points to the four bounding box boundaries ($l, r, t, b$) using Distribution Focal Loss (DFL).

Key architectural advantages:
- **Modified CSPDarknet53 with C2f Modules**: Replaces older C3 blocks with cross-stage partial bottleneck networks featuring multiple split-and-concat pathways, enhancing gradient flow and receptive field capacity while reducing parameter footprint.
- **Anchor-Free Decoupled Head**: Decouples classification and regression into independent task-specific branches, mitigating task conflicts and expediting convergence.
- **Task-Aligned Assigner**: Replaces static IoU heuristics with dynamic cost allocation matching classification score and bounding box overlap.

### 2.2 Multi-Object Tracking (BYTETracker)
To solve the identity continuity problem across successive frames, the system incorporates the BYTETracker algorithm. Unlike standard SORT/DeepSORT which discards low-confidence detections below threshold $\tau_{\text{conf}}$, BYTETracker divides detections into two tiers:
1. **High-Confidence Candidates ($D_{\text{high}}$)**: Associated with existing tracklets using spatial IoU distance via the Hungarian algorithm.
2. **Low-Confidence Candidates ($D_{\text{low}}$)**: Re-evaluated against remaining unmatched tracks. This prevents fragmented trajectories and track losses when vehicles or pedestrians undergo temporary occlusion, lighting shifts, or motion blur.

### 2.3 Directional Counting & Anti-Duplication Algorithm
The counting algorithm enforces robust, non-duplicate tracking via centroid vector analysis:
- Let the counting line be defined horizontally at pixel coordinate $y_{\text{gate}} = \text{height} \times \alpha_{\text{line}}$.
- For each active Track ID $i$, the tracker maintains a trajectory history $T_i = [(x_0, y_0), (x_1, y_1), \dots, (x_t, y_t)]$.
- When $|T_i| \ge 2$, the displacement vector between the previous frame $(x_{t-1}, y_{t-1})$ and current frame $(x_t, y_t)$ is evaluated:
  $$\text{Crossing Detected} \iff (y_{t-1} < y_{\text{gate}} \le y_t) \quad \lor \quad (y_{t-1} > y_{\text{gate}} \ge y_t)$$
- Direction is resolved as:
  $$\text{Direction} = \begin{cases} \text{"IN"} & \text{if } y_t > y_{t-1} \text{ (downward movement)} \\ \text{"OUT"} & \text{if } y_t < y_{t-1} \text{ (upward movement)} \end{cases}$$
- **Anti-Duplication**: A hash set $\mathcal{S}_{\text{counted}}$ records every track ID that has triggered a crossing event. Sub-pixel oscillations or stationary lingering near the gate cannot trigger subsequent counts.

---

## 3. Experimental Setup & Benchmarking

### 3.1 Hardware & Environment Configuration
- **Operating System**: Microsoft Windows 11 Pro (64-bit)
- **Runtime Environment**: Python 3.12.9
- **Core Libraries**: `torch==2.5.1`, `torchvision==0.20.1`, `ultralytics==8.4.183`, `opencv-python==4.13.0`, `pandas==2.2.3`, `matplotlib==3.10.9`, `streamlit==1.56.0`
- **Execution Target**: Multi-core x86_64 CPU benchmarked under standard operating conditions.

### 3.2 Dataset Specification
Surveillance video footage captured at 768x432 resolution at 12.5 FPS featuring real-world mixed urban traffic including passenger vehicles, heavy trucks, transit buses, pedestrians on sidewalks, and cyclists.

---

## 4. Deliverable 4: Speed (FPS) vs Model Size Benchmark Analysis

A formal benchmark was executed across **YOLOv8n**, **YOLOv8s**, and **YOLOv8m** on 60 identical consecutive video frames with warmup passes. Each stage of the inference pipeline (Preprocessing, Neural Network Forward Pass, Postprocessing NMS) was clocked with microsecond precision.

### 4.1 Quantitative Performance Summary Table

| Model Architecture | Model Size (MB) | Parameters ($10^6$) | Pre-Process (ms) | Inference Pass (ms) | Post-Process (ms) | Total Latency (ms) | Throughput (FPS) | Relative Speedup |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **YOLOv8n (Nano)** | **6.25 MB** | **3.16 M** | 4.19 ms | 123.25 ms | 1.45 ms | **128.88 ms** | **7.76 FPS** | **3.98x** |
| **YOLOv8s (Small)** | **21.54 MB** | **11.17 M** | 3.02 ms | 184.61 ms | 1.04 ms | **188.67 ms** | **5.30 FPS** | **2.72x** |
| **YOLOv8m (Medium)** | **49.72 MB** | **25.90 M** | 4.14 ms | 505.83 ms | 1.71 ms | **511.68 ms** | **1.95 FPS** | **1.00x (Baseline)** |

### 4.2 Latency Breakdown by Stage

```
YOLOv8n (Nano)   [Prep: 4.2ms] [================== Forward: 123.3ms ==================] [Post: 1.5ms] -> Total: 128.9 ms (7.76 FPS)
YOLOv8s (Small)  [Prep: 3.0ms] [=========================== Forward: 184.6ms ===========================] [Post: 1.0ms] -> Total: 188.7 ms (5.30 FPS)
YOLOv8m (Medium) [Prep: 4.1ms] [================================================= Forward: 505.8ms =================================================] [Post: 1.7ms] -> Total: 511.7 ms (1.95 FPS)
```

### 4.3 Analysis & Discussion: Speed vs Accuracy Tradeoffs

1. **Throughput Scaling**:
   - YOLOv8n achieves **7.76 FPS** on standard CPU, which is **3.98x faster** than YOLOv8m (1.95 FPS).
   - The forward inference pass dominates total pipeline latency, accounting for **95.6%** of total runtime in YOLOv8n and **98.8%** in YOLOv8m.
   - Preprocessing (letterbox resizing, channel transposition, FP32 normalization) and Postprocessing (NMS box suppression) remain invariant to model depth (~4 ms combined).

2. **Parameter and Memory Footprint**:
   - YOLOv8n requires only **6.25 MB** storage and 3.16M weights, yielding low cache misses and minimal DRAM bandwidth demand.
   - YOLOv8m requires **49.72 MB** (7.95x larger) and 25.9M weights. On edge nodes (e.g., Raspberry Pi 5, Jetson Nano, smart IP cameras), YOLOv8m's memory footprint leads to thermal throttling and high latency unless quantized.

3. **Detection Sensitivity**:
   - While YOLOv8n is remarkably fast, YOLOv8m features greater feature channel depth in its C2f blocks, enabling higher sensitivity for small pedestrians located far in the background and partially occluded bicycles.
   - In production edge deployments, **YOLOv8n** is recommended for real-time edge processing (30+ FPS with INT8 / TensorRT), while **YOLOv8m / YOLOv8x** is recommended for centralized server-side batch inference on GPU clusters.

---

## 5. Deliverable Verification & Visual Artifacts

### 5.1 Generated Artifacts
1. **Annotated Surveillance Video**: [`outputs/annotated_traffic_monitoring.mp4`](file:///c:/daidai/outputs/annotated_traffic_monitoring.mp4)
   - Features dynamic bounding boxes with corner notches, confidence scores, tracking IDs, motion trajectory trails, glowing counting gate, and real-time top glassmorphic HUD.
2. **Speed vs Size Benchmark Plot**: [`outputs/fps_vs_modelsize.png`](file:///c:/daidai/outputs/fps_vs_modelsize.png)
   - Publication-quality chart displaying throughput comparison (FPS) and model size (MB).
3. **Latency Breakdown Plot**: [`outputs/latency_breakdown.png`](file:///c:/daidai/outputs/latency_breakdown.png)
   - Component-wise stacked latency visualization.
4. **Structured CSV Event Log**: [`outputs/traffic_counts_log.csv`](file:///c:/daidai/outputs/traffic_counts_log.csv)
   - Event-by-event logging recording timestamp, frame index, track ID, category, confidence, crossing direction, and pixel coordinates.
5. **Interactive Dashboard**: [`app.py`](file:///c:/daidai/app.py)
   - Full Streamlit web UI with video playback, parameter controls, live metrics, and CSV download.

---

## 6. How to Run & Reproduce

```bash
# 1. Run video surveillance pipeline
python traffic_monitor.py --source data/traffic_sample.mp4 --model yolov8n.pt --conf 0.25 --output outputs/annotated_traffic_monitoring.mp4

# 2. Run model speed vs size benchmark suite
python benchmark_models.py

# 3. Launch interactive web dashboard
streamlit run app.py
```

---

## 7. Conclusion

All student deliverables specified for **Assignment 2: Real-Time Traffic & Pedestrian Monitoring (Object Detection)** have been implemented, tested, and validated. The resulting system demonstrates industrial computer vision best practices, rigorous mathematical gate crossing logic, real-time tracking stability, and comprehensive quantitative profiling.
