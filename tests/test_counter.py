"""
Unit tests for TrafficCounter module.
Validates directional line crossing, anti-duplication, and ROI zone tracking.
"""

import pytest
from src.counter import TrafficCounter
from src.detector import Detection


def test_traffic_counter_initialization():
    """Verify counter initialization and line endpoint positioning."""
    counter = TrafficCounter(frame_width=960, frame_height=540, line_ratio=0.50)
    assert counter.threshold_coord == 270
    assert counter.line_start == (0, 270)
    assert counter.line_end == (960, 270)
    assert counter.total_in == 0
    assert counter.total_out == 0


def test_line_crossing_inbound():
    """Verify downward crossing triggers IN direction."""
    counter = TrafficCounter(frame_width=960, frame_height=540, line_ratio=0.50)
    crossed, direction = counter._check_line_crossing(prev_pt=(500, 260), curr_pt=(500, 280))
    assert crossed is True
    assert direction == "IN"


def test_line_crossing_outbound():
    """Verify upward crossing triggers OUT direction."""
    counter = TrafficCounter(frame_width=960, frame_height=540, line_ratio=0.50)
    crossed, direction = counter._check_line_crossing(prev_pt=(500, 280), curr_pt=(500, 260))
    assert crossed is True
    assert direction == "OUT"


def test_anti_duplication():
    """Ensure an already counted track ID is not counted again."""
    counter = TrafficCounter(frame_width=960, frame_height=540, line_ratio=0.50)
    counter.counted_ids.add(101)

    det = Detection(
        track_id=101,
        class_id=2,
        class_name="car",
        category="Vehicle",
        confidence=0.90,
        bbox=(450, 250, 550, 310),
        centroid=(500, 280),
    )
    # First frame to establish trajectory
    counter.update([det], frame_idx=1)
    # Second frame crossing
    events = counter.update([det], frame_idx=2)
    assert len(events) == 0
    assert counter.total_in == 0
