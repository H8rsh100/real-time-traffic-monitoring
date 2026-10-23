# Multi-Stage Dockerfile for Real-Time Traffic & Surveillance System

# 1. Frontend Build Stage
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# 2. Python Backend & Engine Stage
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies for OpenCV and video codecs
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code, models, and server
COPY src/ ./src/
COPY data/ ./data/
COPY server.py traffic_monitor.py benchmark_models.py app.py ./
COPY *.pt ./

# Copy built frontend assets from Stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

EXPOSE 8080 8501

CMD ["python", "server.py"]
