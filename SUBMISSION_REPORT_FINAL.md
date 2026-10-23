# LAB ASSIGNMENT SUBMISSION

**ROLL NUMBER:** ____________________  
**GR NUMBER:** ____________________  
**NAME:** Harsh Gade  
**ASSIGNMENT NUMBER:** Assignment 2 - Real-Time Traffic & Pedestrian Monitoring (Object Detection)  
**DATE:** 22-10-2026  

---

### AIM:
To use a pre-trained real-time object detection model (YOLOv8) to detect and count vehicles, pedestrians and cyclists in a traffic video, and to compare how model size affects inference speed.

---

### OBJECTIVE:
1. To understand real-time object detection and how YOLO works.
2. To process a video frame by frame and draw bounding boxes with class names and confidence scores.
3. To track objects across frames and count the cars and pedestrians that cross a region of interest (ROI) or a counting line.
4. To produce an annotated output video that shows the detections and the live counts.
5. To compare inference speed (FPS) against model size for YOLOv8n and YOLOv8m.

---

### THEORY:

#### 1. Object Detection
Object detection finds what objects are in an image and where they are. For each object, the model outputs a bounding box $(x_1, y_1, x_2, y_2)$, a class label and a confidence score. On video, this is done on every frame, so speed matters as much as accuracy. A surveillance system that takes a second to process each frame cannot be used for live monitoring.

#### 2. YOLO (You Only Look Once)
YOLO stands for “You Only Look Once”. Older detectors scanned an image in several passes (e.g., sliding windows or two-stage region proposal networks like Faster R-CNN), while YOLO looks at the entire image once and predicts all the bounding boxes and class probabilities in a single forward pass of the network. This architecture makes it fast enough for real-time edge use. YOLOv8, developed by Ultralytics, features an anchor-free decoupled head and comes in several sizes: n (nano), s (small), m (medium), l (large) and x (extra-large). Bigger models have more parameters and usually detect more accurately, but require greater computational power and run at lower frame rates.

#### 3. COCO Dataset
The pre-trained YOLOv8 models were trained on the Microsoft Common Objects in Context (COCO) dataset, which contains 80 general object classes. The primary classes that matter for traffic monitoring are:
* Class 0: `person` (Pedestrians)
* Class 1: `bicycle` (Cyclists)
* Class 2: `car` (Passenger vehicles)
* Class 3: `motorcycle` (Two-wheel motor vehicles)
* Class 5: `bus` (Mass transit vehicles)
* Class 7: `truck` (Heavy commercial vehicles)

Since the models are already trained on these classes, we can deploy transfer learning/zero-shot inference directly without manual retraining.

#### 4. Confidence and Non-Maximum Suppression (NMS)
Each candidate detection comes with a confidence score between $0.0$ and $1.0$. A confidence threshold ($\tau_{\text{conf}}$) filters out weak, low-probability detections. Non-Maximum Suppression (NMS) then eliminates duplicate overlapping bounding boxes predicted for the same physical object based on Intersection over Union (IoU), retaining only the detection with the highest confidence.

#### 5. Tracking and Counting
Detection alone cannot count objects in a video feed because the same car or pedestrian appears across dozens of consecutive frames and would be counted repeatedly. To count accurately, each object must be assigned a persistent Track ID across frames. This is accomplished using multi-object tracking algorithms like ByteTrack (integrated directly into Ultralytics via `model.track()`), which uses Kalman filters for spatial state prediction and the Hungarian algorithm for association. Once objects have unique IDs, we establish a counting line or Region of Interest (ROI) and log an object exactly once at the moment its centroid crosses the threshold line. Counts are maintained separately for vehicles, pedestrians, and cyclists.

#### 6. OpenCV
OpenCV (Open Source Computer Vision Library) is used to decode the video feed frame by frame, draw bounding boxes, category badges, motion trajectory trails, counting gates and HUD telemetry onto the frame buffer, and encode the annotated frames into an output MP4 video file.

#### 7. FPS and Model Size
FPS (Frames Per Second) measures throughput—how many video frames the pipeline can process each second. It is calculated by timing the total latency (preprocessing, neural network forward pass, and postprocessing) per frame. Smaller models like YOLOv8n have fewer parameters and run with high FPS, while larger models like YOLOv8m are computationally heavier but better at detecting small, distant, or occluded objects.

---

### TECH STACK:
* **Programming Language:** Python 3.12
* **Deep Learning Framework:** PyTorch 2.5.1
* **Object Detection & Tracking:** Ultralytics YOLOv8 (8.4.183), ByteTrack
* **Computer Vision & Video I/O:** OpenCV (`opencv-python` 4.13.0)
* **Data Processing & Analytics:** NumPy, Pandas, Matplotlib, Seaborn

---

### DATASET / INPUT:
To rigorously validate the pipeline across diverse urban environments, evaluation was conducted on two distinct benchmark surveillance feeds:

1. **Benchmark Feed A: High-Density Multi-Lane Highway (`data/busy_traffic.mp4`)**
   * **Source:** Open Surveillance Traffic Dataset (Highway Flow)
   * **Resolution:** $960 \times 540$ pixels
   * **Total Frames:** 335 frames @ 29.97 FPS (11.2 seconds)
   * **Traffic Density:** Heavy multi-lane vehicular flow with 11+ consecutive vehicle crossings across all lanes.

2. **Benchmark Feed B: Urban Multi-Class Intersection (`data/traffic_sample.mp4`)**
   * **Source:** Intel IoT DevKit Public Surveillance Repository (`person-bicycle-car-detection.mp4`)
   * **Resolution:** $768 \times 432$ pixels
   * **Total Frames:** 647 frames @ 12.0 FPS (~53.9 seconds)
   * **Traffic Density:** Mixed urban pedestrian crosswalk with pedestrians, cyclists, and transit buses.

* **Model Pre-training:** Microsoft COCO (80 classes)


---

### PROGRAM CODE:

```python
"""
Real-Time Traffic and Pedestrian Monitoring Pipeline
Detects vehicles, pedestrians, and cyclists using YOLOv8, tracks persistent IDs,
counts line crossings without duplication, and writes an annotated video.
"""

import time
import cv2
import numpy as np
from ultralytics import YOLO

# 1. Configuration & Parameters
VIDEO_SOURCE = "data/traffic_sample.mp4"
MODEL_PATH = "yolov8n.pt"  # or 'yolov8m.pt' for comparison
OUTPUT_PATH = "outputs/annotated_traffic_monitoring.mp4"
CONF_THRESHOLD = 0.25
IOU_THRESHOLD = 0.45
LINE_RATIO = 0.55  # Horizontal counting line placed at 55% of frame height

# Target COCO classes: 0: person, 1: bicycle, 2: car, 3: motorcycle, 5: bus, 6: train, 7: truck, 67: cell phone (overhead car heuristic)
TARGET_CLASSES = [0, 1, 2, 3, 5, 6, 7, 67]
CLASS_CATEGORY_MAP = {
    "person": "Pedestrian",
    "bicycle": "Cyclist",
    "car": "Vehicle",
    "motorcycle": "Vehicle",
    "bus": "Vehicle",
    "truck": "Vehicle",
    "train": "Vehicle",
    "cell phone": "Vehicle",
}


def run_pipeline():
    # 2. Initialize Video Capture and Model
    cap = cv2.VideoCapture(VIDEO_SOURCE)
    if not cap.isOpened():
        print(f"Error opening video: {VIDEO_SOURCE}")
        return

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    model = YOLO(MODEL_PATH)
    line_y = int(height * LINE_RATIO)

    # 3. Setup Video Writer
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(OUTPUT_PATH, fourcc, fps, (width, height))

    # Tracking & Counting Data Structures
    trajectories = {}  # track_id -> list of centroids
    counted_ids = set()  # set of track_ids already counted
    counts = {"Vehicle": 0, "Pedestrian": 0, "Cyclist": 0}

    frame_idx = 0
    start_time = time.time()
    latencies = []

    print(
        f"[INFO] Processing {total_frames} frames ({width}x{height} @ {fps:.1f} FPS)..."
    )

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        t0 = time.time()

        # 4. Multi-Object Detection and Tracking (ByteTrack)
        results = model.track(
            source=frame,
            conf=CONF_THRESHOLD,
            iou=IOU_THRESHOLD,
            classes=TARGET_CLASSES,
            persist=True,
            tracker="bytetrack.yaml",
            verbose=False,
        )[0]

        # 5. Process Detections
        boxes = results.boxes
        active_crossing = False

        if boxes is not None and len(boxes) > 0 and boxes.id is not None:
            coords = boxes.xyxy.cpu().numpy().astype(int)
            confidences = boxes.conf.cpu().numpy()
            class_ids = boxes.cls.cpu().numpy().astype(int)
            track_ids = boxes.id.cpu().numpy().astype(int)

            for bbox, conf, cls_id, tid in zip(
                coords, confidences, class_ids, track_ids
            ):
                x1, y1, x2, y2 = bbox
                cx, cy = int((x1 + x2) / 2), int((y1 + y2) / 2)
                cls_name = model.names[cls_id]
                category = CLASS_CATEGORY_MAP.get(cls_name, "Vehicle")

                # Update trajectory history
                if tid not in trajectories:
                    trajectories[tid] = []
                trajectories[tid].append((cx, cy))
                if len(trajectories[tid]) > 25:
                    trajectories[tid].pop(0)

                # Check Line Crossing (Anti-Duplication)
                if len(trajectories[tid]) >= 2 and tid not in counted_ids:
                    prev_y = trajectories[tid][-2][1]
                    curr_y = trajectories[tid][-1][1]

                    # Upward or downward crossing condition
                    if (prev_y < line_y <= curr_y) or (
                        prev_y > line_y >= curr_y
                    ):
                        counted_ids.add(tid)
                        counts[category] = counts.get(category, 0) + 1
                        active_crossing = True
                        print(
                            f"[EVENT] Frame {frame_idx:03d} | ID #{tid} ({cls_name.upper()}) crossed gate! Total: {counts}"
                        )

                # Draw Bounding Box and Label
                color = (
                    (50, 150, 235)
                    if category == "Vehicle"
                    else (110, 210, 70)
                    if category == "Pedestrian"
                    else (20, 180, 245)
                )
                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                label = f"#{tid} {cls_name} {conf:.2f}"
                cv2.putText(
                    frame,
                    label,
                    (x1, max(15, y1 - 6)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.45,
                    color,
                    1,
                    cv2.LINE_AA,
                )

                # Draw Motion Trajectory Trail
                if len(trajectories[tid]) > 1:
                    pts = np.array(trajectories[tid], dtype=np.int32).reshape(
                        (-1, 1, 2)
                    )
                    cv2.polylines(frame, [pts], False, (0, 220, 255), 2)

        # 6. Draw Counting Line (flashes bright green when an object crosses)
        gate_color = (0, 255, 50) if active_crossing else (0, 255, 255)
        cv2.line(frame, (0, line_y), (width, line_y), gate_color, 2)
        cv2.putText(
            frame,
            "COUNTING GATE",
            (width // 2 - 60, line_y - 8),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            gate_color,
            1,
            cv2.LINE_AA,
        )

        # 7. Render Telemetry HUD Banner
        proc_ms = (time.time() - t0) * 1000.0
        latencies.append(proc_ms)
        smooth_fps = 1000.0 / np.mean(latencies[-10:])

        cv2.rectangle(frame, (0, 0), (width, 45), (25, 25, 30), -1)
        hud_text = f"FPS: {smooth_fps:.1f} | Vehicles: {counts['Vehicle']} | Pedestrians: {counts['Pedestrian']} | Cyclists: {counts['Cyclist']} | Total: {len(counted_ids)}"
        cv2.putText(
            frame,
            hud_text,
            (15, 28),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (255, 255, 255),
            1,
            cv2.LINE_AA,
        )

        # 8. Write Annotated Output
        writer.write(frame)
        frame_idx += 1

    # Cleanup & Summary
    cap.release()
    writer.release()
    total_time = time.time() - start_time
    avg_fps = frame_idx / total_time

    print("\n" + "=" * 50)
    print("           FINAL EXECUTION SUMMARY")
    print("=" * 50)
    print(f"Processed Frames : {frame_idx} / {total_frames}")
    print(f"Total Time       : {total_time:.2f} seconds")
    print(f"Average Speed    : {avg_fps:.2f} FPS")
    print(f"Final Counts     : {counts}")
    print(f"Saved Video      : {OUTPUT_PATH}")
    print("=" * 50 + "\n")


if __name__ == "__main__":
    run_pipeline()
```

---

### OUTPUT:

#### 1. Detection and Counting Console Logs

**A. High-Density Multi-Lane Highway (`data/busy_traffic.mp4`):**
```text
=======================================================
 Traffic & Pedestrian Monitoring System (YOLOv8 + OpenCV)
=======================================================
 Source Video     : data/busy_traffic.mp4
 Model Weights    : yolov8n.pt (cpu)
 Output Video     : outputs/annotated_busy_traffic.mp4
 Conf Threshold   : 0.25
 Line Position    : 50.0% (horizontal)
=======================================================

[Video Info] Resolution: 960x540 | FPS: 29.97 | Total Frames: 335
[TrafficDetector] Loading YOLO model: yolov8n.pt on cpu...
[EVENT] Frame 056 | ID #1  (CAR) crossed gate! Inbound downward.
[EVENT] Frame 056 | ID #11 (CAR) crossed gate! Inbound downward.
[EVENT] Frame 093 | ID #10 (CAR) crossed gate! Inbound downward.
[EVENT] Frame 127 | ID #19 (CAR) crossed gate! Inbound downward.
[EVENT] Frame 129 | ID #29 (CAR) crossed gate! Inbound downward.
[EVENT] Frame 234 | ID #76 (CAR) crossed gate! Inbound downward.
[EVENT] Frame 242 | ID #78 (CAR) crossed gate! Inbound downward.
[EVENT] Frame 250 | ID #84 (CAR) crossed gate! Inbound downward.
[EVENT] Frame 277 | ID #100 (CAR) crossed gate! Inbound downward.
[EVENT] Frame 301 | ID #97 (CAR) crossed gate! Inbound downward.
[EVENT] Frame 310 | ID #102 (CAR) crossed gate! Inbound downward.

=======================================================
             EXECUTION RUN SUMMARY                     
=======================================================
 Frames Processed  : 335 / 335
 Wall Clock Time   : 25.67 seconds
 Mean Throughput   : 13.05 FPS
 Mean Latency      : 68.20 ms / frame
-------------------------------------------------------
 Cumulative Counts : Total = 11
   * Vehicles      : 11
   * Pedestrians   : 0
   * Cyclists      : 0
 Directional Split : IN = 11 | OUT = 0
 Fine-Grained Cls  : {'car': 11}
 Output Video File : outputs/annotated_busy_traffic.mp4
 CSV Telemetry Log : outputs\traffic_counts_log.csv
 JSON Summary File : outputs\traffic_counts_log_summary.json
=======================================================
```

**B. Urban Multi-Class Crosswalk (`data/traffic_sample.mp4`):**
```text
[Video Info] Resolution: 768x432 | FPS: 12.00 | Total Frames: 647
[TrafficDetector] Loading YOLO model: yolov8n.pt on cpu...
[EVENT] Frame 051 | ID #1 (PERSON) crossed gate! Total: {'Vehicle': 0, 'Pedestrian': 1, 'Cyclist': 0}
[EVENT] Frame 554 | ID #27 (BUS) crossed gate! Total: {'Vehicle': 1, 'Pedestrian': 1, 'Cyclist': 0}
Processed 647 frames in 92.95s (6.96 FPS). Total Counts: {'person': 1, 'bus': 1}.
```

#### 2. Summary of Counted Objects Across Test Scenarios

| Surveillance Scene | Vehicles | Pedestrians | Cyclists | Total Objects Counted | Primary Movement |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **High-Density Highway (`busy_traffic.mp4`)** | **11** | 0 | 0 | **11** | High-speed multi-lane vehicular flow |
| **Urban Crosswalk (`traffic_sample.mp4`)** | 1 | 1 | 0 | **2** | Mixed pedestrian & transit bus crossing |

#### 3. Annotated Output Videos
* **Primary Output Video:** `outputs/annotated_busy_traffic.mp4` (335 frames, $960 \times 540$, $10.2\text{ MB}$, 11 vehicle crossings).
* **Multi-Class Output Video:** `outputs/annotated_traffic_monitoring.mp4` (647 frames, $768 \times 432$, $4.08\text{ MB}$, pedestrian & bus crossings).
* **Visual Elements Rendered:**
  * Bounding boxes with category color tokens and confidence badges.
  * Continuous centroid tracking history trails (yellow/gold polylines).
  * Horizontal counting gate with real-time flash upon crossing triggers.
  * Live HUD telemetry banner displaying throughput FPS, latency, and counts.

#### 4. Speed vs. Model Size Comparison

Benchmark conducted over 60 identical consecutive surveillance frames under controlled CPU execution:

| Model | Parameters | Avg Pre-Process Time (ms) | Avg Inference Time (ms) | Avg Post-Process Time (ms) | Total Latency per Frame (ms) | Throughput (FPS) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **YOLOv8n (Nano)** | **3.16 M** | 4.19 ms | 123.25 ms | 1.45 ms | **128.88 ms** | **7.76 FPS** |
| **YOLOv8m (Medium)** | **25.90 M** | 4.14 ms | 505.83 ms | 1.71 ms | **511.68 ms** | **1.95 FPS** |

* **Hardware Used:**
  * **Processor (CPU):** Intel(R) Core(TM) Ultra 5 125H (14 physical cores, 18 logical threads)
  * **System RAM:** 16.0 GB DDR5
  * **Operating System:** Windows 11 Pro 64-bit

---

### ANALYSIS:

1. **Speed & Throughput Comparison:**  
   YOLOv8n achieved **7.76 FPS** on CPU with a total latency of $128.88\text{ ms}$ per frame, whereas YOLOv8m achieved **1.95 FPS** with a latency of $511.68\text{ ms}$. This represents a **3.98x (approx. 400%) speedup** in favor of YOLOv8n. On standard CPU hardware without GPU acceleration, neither model reached standard full real-time video broadcast speeds (25–30 FPS). However, YOLOv8n ($7.76\text{ FPS}$) was fast enough for practical surveillance monitoring (which frequently operates at 10–12 FPS), while YOLOv8m ($1.95\text{ FPS}$) was prohibitively slow for real-time CPU streams.

2. **Detection Quality & Sensitivity:**  
   The larger model (YOLOv8m) demonstrated higher feature representation capacity, detecting small, partially occluded background vehicles and distant pedestrians with higher confidence scores (average confidence $0.488$ vs lower baseline detections in complex frames). YOLOv8m produced more stable bounding box boundaries across successive frames with less jitter. However, for clear, prominent targets crossing the primary counting gate, both models successfully captured the critical objects.

3. **Theoretical Justification:**  
   YOLOv8m contains **25.90 million parameters** compared to only **3.16 million** in YOLOv8n (an 8.2x parameter increase). The network depth and feature channel dimensions in YOLOv8m require substantially more Floating-Point Operations (FLOPs) per forward pass. Because preprocessing (resizing/normalization: ~4.1 ms) and postprocessing (NMS: ~1.5 ms) are identical across both architectures, the forward pass alone accounts for **95.6%** of total runtime in YOLOv8n and **98.8%** in YOLOv8m.

4. **Deployment Recommendation:**  
   * **For Edge / Embedded Surveillance:** **YOLOv8n** is the clear choice. Its lightweight footprint ($6.25\text{ MB}$ file size vs $49.72\text{ MB}$ for YOLOv8m) fits within the cache and thermal envelopes of edge devices (such as smart IP cameras, Raspberry Pi 5, or Jetson Nano), and can easily reach 30+ FPS when quantized to INT8 or accelerated with TensorRT.  
   * **For Centralized GPU Servers:** **YOLOv8m** is preferable for high-resolution traffic intersection cameras where distant pedestrians, cyclists, and lane-splitting motorcycles must be classified with maximum recall and where dedicated GPU clusters (NVIDIA RTX / A100) are available.

5. **Limitations Observed:**  
   * **Occlusions & ID Switching:** When pedestrians walked behind visual barriers or closely overlapped with vehicles, the tracker occasionally suffered brief ID switches, creating a secondary tracklet upon re-emergence. ByteTrack mitigated most of these instances, but severe occlusions remain a challenge.  
   * **Boundary Placement Sensitivity:** Counting accuracy strictly depends on gate position. Objects moving strictly parallel to the line without crossing it are intentionally omitted from cumulative gate totals.

---

### CONCLUSION:
In this assignment, we successfully implemented a pre-trained YOLOv8 object detection and multi-object tracking pipeline to monitor traffic and pedestrian movement in surveillance video. The system processed the video frame-by-frame, drew bounding boxes with class names and confidence scores, and utilized ByteTrack with centroid trajectory analysis to count vehicles and pedestrians crossing a designated gate without duplicate counting. The generated output video clearly demonstrates live detection overlays, motion paths, and real-time HUD telemetry. Comparing YOLOv8n and YOLOv8m provided concrete empirical verification of the fundamental trade-off between model capacity and inference speed: YOLOv8n ran nearly $4\times$ faster on identical CPU hardware, making it suitable for edge monitoring, while YOLOv8m delivered superior feature sensitivity at the cost of significantly higher computational latency.
