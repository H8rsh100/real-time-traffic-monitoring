"""
Real-Time Traffic & Pedestrian Monitoring Dashboard.
Interactive Streamlit Application for Video Surveillance, Object Tracking, and Telemetry Analytics.
"""

import json
import os
import tempfile
import time
import cv2
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import streamlit as st

from src.counter import TrafficCounter
from src.detector import TrafficDetector
from src.logger import TrafficLogger
from src.visualizer import Visualizer

# Page Configuration
st.set_page_config(
    page_title="Urban Surveillance & Traffic Monitoring",
    page_icon="🚦",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Custom Styling
st.markdown(
    """
    <style>
    .main-title {
        font-size: 2.2rem;
        font-weight: 800;
        background: linear-gradient(90deg, #10b981, #06b6d4, #3b82f6);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 0.2rem;
    }
    .sub-title {
        color: #94a3b8;
        font-size: 1.05rem;
        margin-bottom: 1.5rem;
    }
    .metric-card {
        background: #1e293b;
        border: 1px solid #334155;
        border-radius: 10px;
        padding: 15px;
        text-align: center;
    }
    </style>
    """,
    unsafe_allow_html=True,
)


def main():
    st.markdown('<div class="main-title">🚦 Real-Time Traffic & Pedestrian Surveillance</div>', unsafe_allow_html=True)
    st.markdown(
        '<div class="sub-title">YOLOv8 Object Detection, Multi-Object Tracking, Trajectory Line Crossing & Speed Profiling</div>',
        unsafe_allow_html=True,
    )

    # Sidebar: Configurations
    with st.sidebar:
        st.header("⚙️ Surveillance Controls")

        st.subheader("1. Video Source")
        source_mode = st.radio(
            "Select Feed Source",
            ["Preset: Highway Traffic", "Preset: Urban Multi-Class", "Upload Custom Video"],
        )

        video_path = None
        if source_mode == "Preset: Highway Traffic":
            video_path = "data/car_detection.mp4"
        elif source_mode == "Preset: Urban Multi-Class":
            video_path = "data/traffic_sample.mp4"
        else:
            uploaded_file = st.file_uploader("Upload MP4 / AVI video", type=["mp4", "avi", "mov"])
            if uploaded_file is not None:
                tfile = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
                tfile.write(uploaded_file.read())
                video_path = tfile.name

        st.subheader("2. Model Architecture")
        model_tier = st.selectbox(
            "Select YOLOv8 Tier",
            ["yolov8n.pt (Nano - High Speed)", "yolov8s.pt (Small - Balanced)", "yolov8m.pt (Medium - High Precision)"],
            index=0,
        )
        model_path = model_tier.split()[0]

        st.subheader("3. Detection Thresholds")
        conf_thresh = st.slider("Confidence Threshold", 0.15, 0.90, 0.35, 0.05)
        iou_thresh = st.slider("NMS IoU Threshold", 0.20, 0.80, 0.45, 0.05)

        st.subheader("4. Gate & Overlay")
        line_ratio = st.slider("Counting Gate Y-Position (%)", 20, 85, 55, 5) / 100.0
        draw_trails = st.checkbox("Show Motion Trails", value=True)
        draw_roi = st.checkbox("Show Monitoring Zone (ROI)", value=True)
        max_frames = st.number_input("Max Frames to Process (0 = All)", min_value=0, max_value=2000, value=150, step=25)

        run_btn = st.button("🚀 Run Live Analysis", type="primary", use_container_width=True)

    # Main Tabs
    tab_surveillance, tab_analytics, tab_benchmark = st.tabs([
        "📹 Surveillance Pipeline", "📊 Traffic Analytics & Logs", "⚡ Model Speed vs Size Analysis"
    ])

    with tab_surveillance:
        if run_btn:
            if not video_path or not os.path.exists(video_path):
                st.error("Please provide a valid video file.")
                return

            cap = cv2.VideoCapture(video_path)
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            fps_feed = cap.get(cv2.CAP_PROP_FPS) or 25.0
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            limit = min(total_frames, max_frames) if max_frames > 0 else total_frames

            st.info(f"Loaded feed: {width}x{height} @ {fps_feed:.1f} FPS | Processing {limit} frames with {model_path}...")

            # Initialize components
            detector = TrafficDetector(model_path=model_path, conf_threshold=conf_thresh, iou_threshold=iou_thresh)
            counter = TrafficCounter(frame_width=width, frame_height=height, line_ratio=line_ratio)
            visualizer = Visualizer(model_tag=os.path.splitext(model_path)[0].upper())
            logger = TrafficLogger(output_dir="outputs", base_name="web_traffic_log")

            output_mp4 = "outputs/web_annotated_feed.mp4"
            fourcc = cv2.VideoWriter_fourcc(*"mp4v")
            writer = cv2.VideoWriter(output_mp4, fourcc, fps_feed, (width, height))

            # UI Placeholders for live streaming simulation
            col_kpi1, col_kpi2, col_kpi3, col_kpi4, col_kpi5 = st.columns(5)
            kpi_total = col_kpi1.empty()
            kpi_veh = col_kpi2.empty()
            kpi_ped = col_kpi3.empty()
            kpi_cyc = col_kpi4.empty()
            kpi_fps = col_kpi5.empty()

            progress_bar = st.progress(0.0)
            status_text = st.empty()
            video_frame_placeholder = st.empty()

            frame_idx = 0
            latencies = []
            start_proc = time.time()

            while cap.isOpened() and frame_idx < limit:
                ret, frame = cap.read()
                if not ret:
                    break

                t0 = time.time()
                detections, timing = detector.detect_and_track(frame, persist=True)
                new_events = counter.update(detections, frame_idx=frame_idx, fps=fps_feed)
                if new_events:
                    logger.log_events(new_events)

                proc_ms = (time.time() - t0) * 1000.0
                latencies.append(proc_ms)
                smooth_latency = sum(latencies[-8:]) / len(latencies[-8:])
                smooth_fps = 1000.0 / smooth_latency if smooth_latency > 0 else 0.0

                annotated = visualizer.draw_dashboard(
                    frame=frame,
                    detections=detections,
                    counter=counter,
                    fps=smooth_fps,
                    latency_ms=smooth_latency,
                    draw_trails=draw_trails,
                    draw_roi=draw_roi,
                )

                writer.write(annotated)

                # Update live KPIs periodically
                if frame_idx % 4 == 0 or frame_idx == limit - 1:
                    rgb_frame = cv2.cvtColor(annotated, cv2.COLOR_BGR2RGB)
                    video_frame_placeholder.image(rgb_frame, channels="RGB", use_container_width=True)

                    summary = counter.get_summary()
                    kpi_total.metric("Total Counted", summary["total_crossed"])
                    kpi_veh.metric("Vehicles", summary["counts_by_category"].get("Vehicle", 0))
                    kpi_ped.metric("Pedestrians", summary["counts_by_category"].get("Pedestrian", 0))
                    kpi_cyc.metric("Cyclists", summary["counts_by_category"].get("Cyclist", 0))
                    kpi_fps.metric("Inference FPS", f"{smooth_fps:.1f}")

                frame_idx += 1
                progress_bar.progress(frame_idx / limit)
                status_text.text(f"Processed frame {frame_idx}/{limit} ({smooth_fps:.1f} FPS)...")

            cap.release()
            writer.release()
            progress_bar.empty()
            status_text.success("Processing complete! Output video and analytics saved.")

            st.session_state["last_summary"] = counter.get_summary()
            st.session_state["log_csv"] = logger.csv_path
            st.session_state["output_mp4"] = output_mp4
        else:
            st.info("👈 Select your video source and parameters in the sidebar, then click **'Run Live Analysis'**.")

            # Display last processed video if available
            if os.path.exists("outputs/annotated_traffic_monitoring.mp4"):
                st.subheader("Latest Processed Surveillance Output")
                st.video("outputs/annotated_traffic_monitoring.mp4")

    with tab_analytics:
        st.subheader("📈 Real-Time Telemetry & Crossing Events")
        log_csv = st.session_state.get("log_csv", "outputs/traffic_counts_log.csv")

        if os.path.exists(log_csv):
            df_log = pd.read_csv(log_csv)
            if len(df_log) > 0:
                col1, col2 = st.columns(2)
                with col1:
                    st.write("**Category Breakdown**")
                    cat_counts = df_log["Category"].value_counts()
                    fig, ax = plt.subplots(figsize=(6, 4))
                    cat_counts.plot(kind="bar", color=["#3498db", "#2ecc71", "#f39c12", "#95a5a6"], ax=ax)
                    ax.set_ylabel("Count")
                    ax.set_title("Objects Counted by Category")
                    st.pyplot(fig)

                with col2:
                    st.write("**Directional Distribution (IN vs OUT)**")
                    dir_counts = df_log["Direction"].value_counts()
                    fig2, ax2 = plt.subplots(figsize=(6, 4))
                    dir_counts.plot(kind="pie", autopct="%1.1f%%", colors=["#2ecc71", "#e74c3c"], ax=ax2)
                    ax2.set_ylabel("")
                    ax2.set_title("Traffic Flow Direction Split")
                    st.pyplot(fig2)

                st.subheader("📋 Detailed Crossing Event Log")
                st.dataframe(df_log, use_container_width=True)

                with open(log_csv, "rb") as f:
                    st.download_button(
                        "📥 Download Crossing Event Log (CSV)",
                        f,
                        file_name="traffic_monitoring_events.csv",
                        mime="text/csv",
                    )
            else:
                st.warning("No crossing events logged yet in current file. Ensure objects pass across the counting line.")
        else:
            st.info("Run an analysis run to generate event logs.")

    with tab_benchmark:
        st.subheader("⚡ Model Comparison: Inference Speed vs Model Size (Deliverable 4)")
        st.markdown(
            """
            This section provides the comparative benchmark evaluation across **YOLOv8n**, **YOLOv8s**, and **YOLOv8m**,
            measuring real-time throughput (FPS), hardware latency (ms), parameter count, and model disk footprint.
            """
        )

        benchmark_csv = "outputs/benchmark_results.csv"
        if os.path.exists(benchmark_csv):
            df_bench = pd.read_csv(benchmark_csv)
            st.dataframe(df_bench, use_container_width=True)

            col_b1, col_b2 = st.columns(2)
            with col_b1:
                chart1 = "outputs/fps_vs_modelsize.png"
                if os.path.exists(chart1):
                    st.image(chart1, caption="Figure 1: Inference Speed (FPS) vs Model Size & Parameter Count", use_container_width=True)

            with col_b2:
                chart2 = "outputs/latency_breakdown.png"
                if os.path.exists(chart2):
                    st.image(chart2, caption="Figure 2: Component Latency Breakdown (Preprocess, Forward Pass, NMS)", use_container_width=True)
        else:
            st.info("Run `python benchmark_models.py` to populate comparative charts.")


if __name__ == "__main__":
    main()
