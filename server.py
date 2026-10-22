"""
High-Performance FastAPI WebSocket Streaming Server for Urban Surveillance.
Packs synchronized binary frames:
[4 bytes: 'SURV'] [4 bytes: frame_idx (uint32)] [4 bytes: timestamp_ms (uint32)] [4 bytes: json_len (uint32)]
Followed by:
[json_len bytes of UTF-8 telemetry JSON] [remaining bytes of raw JPEG image]
"""

import asyncio
import json
import os
import struct
import time
from typing import Dict, List, Optional
import cv2
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel

from src.counter import TrafficCounter
from src.detector import TrafficDetector
from src.logger import TrafficLogger

app = FastAPI(title="Surveillance Console Engine API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAGIC_BYTES = b"SURV"


@app.get("/api/status")
async def get_status():
    """System health check and available assets."""
    presets = []
    if os.path.exists("data/busy_traffic.mp4"):
        presets.append({
            "id": "busy",
            "name": "Busy Multi-Lane Traffic (High Flow)",
            "path": "data/busy_traffic.mp4",
        })
    if os.path.exists("data/traffic_sample.mp4"):
        presets.append({
            "id": "urban",
            "name": "Urban Multi-Class (Pedestrians, Cyclists, Vehicles)",
            "path": "data/traffic_sample.mp4",
        })
    if os.path.exists("data/car_detection.mp4"):
        presets.append({
            "id": "highway",
            "name": "Highway Traffic (High-Speed Vehicles)",
            "path": "data/car_detection.mp4",
        })

    return {
        "status": "ONLINE",
        "engine": "YOLOv8 + ByteTrack + FastAPI",
        "presets": presets,
        "models": [
            {"id": "yolov8n.pt", "name": "YOLOv8n (Nano)", "params": "3.16M", "fps": 7.76, "size": "6.25 MB"},
            {"id": "yolov8s.pt", "name": "YOLOv8s (Small)", "params": "11.17M", "fps": 5.30, "size": "21.54 MB"},
            {"id": "yolov8m.pt", "name": "YOLOv8m (Medium)", "params": "25.90M", "fps": 1.95, "size": "49.72 MB"},
        ],
    }


@app.get("/api/benchmarks")
async def get_benchmarks():
    """Return formal model speed vs size benchmark results."""
    json_path = "outputs/benchmark_summary.json"
    if os.path.exists(json_path):
        with open(json_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return []


@app.post("/api/upload")
async def upload_video(file: UploadFile = File(...)):
    """Upload custom video for surveillance processing."""
    os.makedirs("data/uploads", exist_ok=True)
    file_path = os.path.join("data/uploads", file.filename)
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
    return {"filename": file.filename, "path": file_path, "size": len(content)}


@app.get("/api/export-csv")
async def export_csv():
    """Download the latest session CSV log."""
    csv_path = "outputs/traffic_counts_log.csv"
    if os.path.exists(csv_path):
        return FileResponse(csv_path, media_type="text/csv", filename="surveillance_telemetry.csv")
    return JSONResponse(status_code=404, content={"error": "No CSV log found"})


def pack_binary_frame(frame_idx: int, timestamp_ms: int, telemetry: dict, jpeg_bytes: bytes) -> bytes:
    """Pack atomic binary frame buffer: Header + JSON + JPEG."""
    json_str = json.dumps(telemetry, separators=(",", ":"))
    json_bytes = json_str.encode("utf-8")
    json_len = len(json_bytes)

    # 16-byte fixed header: [4B magic][4B uint32 frame_idx][4B uint32 timestamp_ms][4B uint32 json_len]
    header = struct.pack(">4sIII", MAGIC_BYTES, frame_idx, timestamp_ms, json_len)
    return header + json_bytes + jpeg_bytes


@app.websocket("/ws/stream")
async def websocket_stream(websocket: WebSocket):
    """
    Main real-time binary streaming channel.
    Synchronously transmits decoded JPEG and vector telemetry per frame.
    """
    await websocket.accept()

    # Wait for initial configuration packet
    try:
        init_data = await websocket.receive_text()
        config = json.loads(init_data)
    except Exception as e:
        await websocket.close()
        return

    source = config.get("source", "data/traffic_sample.mp4")
    model_name = config.get("model", "yolov8n.pt")
    conf_thresh = float(config.get("conf", 0.25))
    iou_thresh = float(config.get("iou", 0.45))
    line_ratio = float(config.get("line_ratio", 0.55))
    max_frames = int(config.get("max_frames", 0))

    if not os.path.exists(source):
        await websocket.send_text(json.dumps({"error": f"Source video not found: {source}"}))
        await websocket.close()
        return

    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        await websocket.send_text(json.dumps({"error": f"Failed to open video: {source}"}))
        await websocket.close()
        return

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 12.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    limit = min(total_frames, max_frames) if max_frames > 0 else total_frames

    detector = TrafficDetector(model_path=model_name, conf_threshold=conf_thresh, iou_threshold=iou_thresh)
    counter = TrafficCounter(frame_width=width, frame_height=height, line_ratio=line_ratio)
    logger = TrafficLogger(output_dir="outputs", base_name="traffic_counts_log")

    frame_idx = 0
    latencies = []
    paused = False

    try:
        # Background listener for client control signals (PAUSE, RESUME, STOP, GATE)
        async def listen_controls():
            nonlocal paused, line_ratio
            while True:
                try:
                    msg = await websocket.receive_text()
                    cmd = json.loads(msg)
                    action = cmd.get("action")
                    if action == "PAUSE":
                        paused = True
                    elif action == "RESUME":
                        paused = False
                    elif action == "STOP":
                        return False
                    elif action == "SET_GATE":
                        line_ratio = float(cmd.get("value", line_ratio))
                        counter.line_ratio = line_ratio
                        counter.threshold_coord = int(height * line_ratio)
                        counter.line_start = (0, counter.threshold_coord)
                        counter.line_end = (width, counter.threshold_coord)
                except Exception:
                    break

        control_task = asyncio.create_task(listen_controls())

        while cap.isOpened() and frame_idx < limit:
            if paused:
                await asyncio.sleep(0.05)
                continue

            ret, frame = cap.read()
            if not ret:
                break

            t0 = time.perf_counter()

            # 1. Detection and Tracking
            detections, timing = detector.detect_and_track(frame, persist=True)

            # 2. Update Counter & Trajectories
            new_events = counter.update(detections, frame_idx=frame_idx, fps=fps)
            if new_events:
                logger.log_events(new_events)

            t_end = time.perf_counter()
            total_frame_ms = (t_end - t0) * 1000.0
            latencies.append(total_frame_ms)
            smooth_latency = float(np.mean(latencies[-8:]))
            smooth_fps = 1000.0 / smooth_latency if smooth_latency > 0 else 0.0

            # 3. Format Telemetry Payload (No drawing done here!)
            active_tracks = []
            for d in detections:
                tid = d.track_id
                trail = list(counter.trajectories[tid]) if tid in counter.trajectories else []
                active_tracks.append({
                    "id": tid,
                    "class": d.class_name,
                    "category": d.category,
                    "conf": round(d.confidence, 3),
                    "bbox": [int(v) for v in d.bbox],
                    "centroid": [int(v) for v in d.centroid],
                    "trail": [[int(pt[0]), int(pt[1])] for pt in trail[-20:]],
                })

            events_payload = []
            for ev in new_events:
                events_payload.append({
                    "frame_idx": ev.frame_idx,
                    "timestamp_sec": ev.timestamp_sec,
                    "track_id": ev.track_id,
                    "class": ev.class_name,
                    "category": ev.category,
                    "conf": round(ev.confidence, 3),
                    "direction": ev.direction,
                    "centroid": [int(v) for v in ev.centroid],
                    "bbox": [int(v) for v in ev.bbox],
                })

            telemetry = {
                "frame_idx": frame_idx,
                "total_frames": limit,
                "timestamp_sec": round(frame_idx / fps, 3),
                "fps": round(smooth_fps, 1),
                "latency_ms": round(smooth_latency, 1),
                "timing": {
                    "preprocess_ms": round(timing["preprocess_ms"], 2),
                    "inference_ms": round(timing["inference_ms"], 2),
                    "postprocess_ms": round(timing["postprocess_ms"], 2),
                    "total_ms": round(total_frame_ms, 2),
                },
                "counts": {
                    "total": counter.total_in + counter.total_out,
                    "in": counter.total_in,
                    "out": counter.total_out,
                    "vehicle": counter.counts_by_category.get("Vehicle", 0),
                    "pedestrian": counter.counts_by_category.get("Pedestrian", 0),
                    "cyclist": counter.counts_by_category.get("Cyclist", 0),
                },
                "gate": {
                    "y_ratio": counter.line_ratio,
                    "y_px": counter.threshold_coord,
                    "active": len(counter.active_crossings) > 0,
                },
                "roi": counter.roi_polygon.tolist() if counter.roi_polygon is not None else [],
                "tracks": active_tracks,
                "events": events_payload,
            }

            # 4. Encode Frame to JPEG
            encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 82]
            _, jpeg_buffer = cv2.imencode(".jpg", frame, encode_param)
            jpeg_bytes = jpeg_buffer.tobytes()

            # 5. Pack and Send Atomic Binary Packet
            timestamp_ms = int(time.time() * 1000) % (2**32)
            packet = pack_binary_frame(frame_idx, timestamp_ms, telemetry, jpeg_bytes)
            await websocket.send_bytes(packet)

            frame_idx += 1
            # Cooperate with event loop
            await asyncio.sleep(0.001)

        # Stream complete signal
        final_packet = pack_binary_frame(
            frame_idx,
            int(time.time() * 1000) % (2**32),
            {"stream_complete": True, "frame_idx": frame_idx, "total_frames": limit},
            b"",
        )
        await websocket.send_bytes(final_packet)
        control_task.cancel()

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[WebSocket Error] {e}")
    finally:
        cap.release()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8080, reload=False, log_level="info")
