#!/usr/bin/env python3
"""
Real-Time Traffic and Pedestrian Monitoring Pipeline.
Student Deliverable:
- Frame-by-frame object detection & tracking (vehicles, pedestrians, cyclists).
- Directional line and ROI crossing counting algorithm with anti-duplication.
- Annotated output video with bounding boxes, confidence badges, motion trails, and live HUD telemetry.
- Event logging to CSV and analytics summary to JSON.
"""

import argparse
import os
import sys
import time
from typing import Optional
import cv2
from tqdm import tqdm

from src.counter import TrafficCounter
from src.detector import TrafficDetector
from src.logger import TrafficLogger
from src.visualizer import Visualizer


def run_pipeline(
    source_video: str = "data/car_detection.mp4",
    model_path: str = "yolov8n.pt",
    output_video: str = "outputs/annotated_traffic_monitoring.mp4",
    conf_threshold: float = 0.35,
    iou_threshold: float = 0.45,
    line_ratio: float = 0.55,
    line_orientation: str = "horizontal",
    max_frames: Optional[int] = None,
    show_window: bool = False,
    draw_trails: bool = True,
    draw_roi: bool = True,
    device: str = "cpu",
):
    """
    Execute full video processing pipeline frame-by-frame.
    """
    if not os.path.exists(source_video):
        raise FileNotFoundError(f"Input video not found: {source_video}")

    os.makedirs(os.path.dirname(output_video) or ".", exist_ok=True)

    print(f"\n=======================================================")
    print(f" Traffic & Pedestrian Monitoring System (YOLOv8 + OpenCV)")
    print(f"=======================================================")
    print(f" Source Video     : {source_video}")
    print(f" Model Weights    : {model_path} ({device})")
    print(f" Output Video     : {output_video}")
    print(f" Conf Threshold   : {conf_threshold}")
    print(f" Line Position    : {line_ratio * 100:.1f}% ({line_orientation})")
    print(f"=======================================================\n")

    # Initialize video capture
    cap = cv2.VideoCapture(source_video)
    if not cap.isOpened():
        raise RuntimeError(f"Failed to open video source: {source_video}")

    total_video_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    video_fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    limit_frames = min(total_video_frames, max_frames) if max_frames else total_video_frames

    print(f"[Video Info] Resolution: {width}x{height} | FPS: {video_fps:.2f} | Total Frames: {total_video_frames}")
    if max_frames:
        print(f"[Run Limit] Processing capped at first {limit_frames} frames.")

    # Initialize Subsystems
    detector = TrafficDetector(
        model_path=model_path,
        conf_threshold=conf_threshold,
        iou_threshold=iou_threshold,
        device=device,
    )

    counter = TrafficCounter(
        frame_width=width,
        frame_height=height,
        line_ratio=line_ratio,
        line_orientation=line_orientation,
    )

    model_tag = os.path.splitext(os.path.basename(model_path))[0].upper()
    visualizer = Visualizer(model_tag=model_tag)
    logger = TrafficLogger(output_dir="outputs", base_name="traffic_counts_log")

    # Initialize Video Writer (using mp4v codec for wide Windows compatibility)
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(output_video, fourcc, video_fps, (width, height))
    if not writer.isOpened():
        print("[Warning] 'mp4v' codec failed, falling back to 'XVID'...")
        fallback_path = output_video.replace(".mp4", ".avi")
        fourcc = cv2.VideoWriter_fourcc(*"XVID")
        writer = cv2.VideoWriter(fallback_path, fourcc, video_fps, (width, height))
        output_video = fallback_path

    # Tracking & Performance metrics
    frame_idx = 0
    start_time = time.time()
    latencies = []

    progress_bar = tqdm(total=limit_frames, desc="Processing Video Frames", unit="frame")

    try:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret or (max_frames and frame_idx >= max_frames):
                break

            t0 = time.time()

            # 1. Detect & Track objects in current frame
            detections, timing = detector.detect_and_track(frame, persist=True)

            # 2. Update counter & evaluate crossing events
            new_events = counter.update(detections, frame_idx=frame_idx, fps=video_fps)

            # 3. Log newly triggered crossing events to CSV
            if new_events:
                logger.log_events(new_events)

            # 4. Compute moving average FPS and Latency
            proc_time_ms = (time.time() - t0) * 1000.0
            latencies.append(proc_time_ms)
            smooth_latency = sum(latencies[-10:]) / len(latencies[-10:])
            smooth_fps = 1000.0 / smooth_latency if smooth_latency > 0 else 0.0

            # 5. Render HUD surveillance overlay
            annotated_frame = visualizer.draw_dashboard(
                frame=frame,
                detections=detections,
                counter=counter,
                fps=smooth_fps,
                latency_ms=smooth_latency,
                draw_trails=draw_trails,
                draw_roi=draw_roi,
            )

            # 6. Write annotated frame to output file
            writer.write(annotated_frame)

            # Optional: Display window
            if show_window:
                cv2.imshow("Surveillance Feed - Live Traffic Monitoring", annotated_frame)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    print("\n[User Interrupt] Processing stopped by user keypress.")
                    break

            frame_idx += 1
            progress_bar.update(1)

    finally:
        progress_bar.close()
        cap.release()
        writer.release()
        if show_window:
            cv2.destroyAllWindows()

    total_elapsed = time.time() - start_time
    avg_fps = frame_idx / total_elapsed if total_elapsed > 0 else 0.0
    avg_latency = sum(latencies) / len(latencies) if latencies else 0.0

    # Build final telemetry summary
    summary = counter.get_summary()
    summary.update({
        "processed_frames": frame_idx,
        "video_duration_sec": round(frame_idx / video_fps, 2),
        "total_processing_time_sec": round(total_elapsed, 2),
        "average_fps": round(avg_fps, 2),
        "average_latency_ms": round(avg_latency, 2),
        "model_used": model_path,
        "output_video_path": output_video,
        "log_csv_path": logger.csv_path,
    })

    logger.save_summary(summary)

    # Print Formatted Executive Report
    print(f"\n=======================================================")
    print(f"             EXECUTION RUN SUMMARY                     ")
    print(f"=======================================================")
    print(f" Frames Processed  : {frame_idx} / {total_video_frames}")
    print(f" Wall Clock Time   : {total_elapsed:.2f} seconds")
    print(f" Mean Throughput   : {avg_fps:.2f} FPS")
    print(f" Mean Latency      : {avg_latency:.2f} ms / frame")
    print(f"-------------------------------------------------------")
    print(f" Cumulative Counts : Total = {summary['total_crossed']}")
    print(f"   * Vehicles      : {summary['counts_by_category'].get('Vehicle', 0)}")
    print(f"   * Pedestrians   : {summary['counts_by_category'].get('Pedestrian', 0)}")
    print(f"   * Cyclists      : {summary['counts_by_category'].get('Cyclist', 0)}")
    print(f" Directional Split : IN = {summary['total_in']} | OUT = {summary['total_out']}")
    print(f" Fine-Grained Cls  : {summary['counts_by_class']}")
    print(f" Output Video File : {output_video}")
    print(f" CSV Telemetry Log : {logger.csv_path}")
    print(f" JSON Summary File : {logger.summary_path}")
    print(f"=======================================================\n")

    return summary


def parse_args():
    parser = argparse.ArgumentParser(description="Real-Time Traffic & Pedestrian Monitoring System")
    parser.add_argument("--source", type=str, default="data/car_detection.mp4", help="Path to video file or webcam index")
    parser.add_argument("--model", type=str, default="yolov8n.pt", help="YOLOv8 model weights (.pt)")
    parser.add_argument("--output", type=str, default="outputs/annotated_traffic_monitoring.mp4", help="Path to output annotated video")
    parser.add_argument("--conf", type=float, default=0.35, help="Confidence threshold (0.0 - 1.0)")
    parser.add_argument("--iou", type=float, default=0.45, help="NMS IoU threshold (0.0 - 1.0)")
    parser.add_argument("--line-ratio", type=float, default=0.55, help="Line position ratio (0.0 - 1.0)")
    parser.add_argument("--line-orientation", type=str, choices=["horizontal", "vertical"], default="horizontal")
    parser.add_argument("--max-frames", type=int, default=None, help="Cap processing at N frames")
    parser.add_argument("--show", action="store_true", help="Show live visualization window")
    parser.add_argument("--no-trails", action="store_true", help="Disable centroid trajectory motion trails")
    parser.add_argument("--no-roi", action="store_true", help="Disable ROI polygon visualization")
    parser.add_argument("--device", type=str, default="cpu", help="Compute device ('cpu' or '0')")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    run_pipeline(
        source_video=args.source,
        model_path=args.model,
        output_video=args.output,
        conf_threshold=args.conf,
        iou_threshold=args.iou,
        line_ratio=args.line_ratio,
        line_orientation=args.line_orientation,
        max_frames=args.max_frames,
        show_window=args.show,
        draw_trails=not args.no_trails,
        draw_roi=not args.no_roi,
        device=args.device,
    )
