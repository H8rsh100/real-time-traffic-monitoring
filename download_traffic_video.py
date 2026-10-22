"""
Download a high-density urban traffic video for surveillance monitoring and counting.
"""
import os
import sys
import urllib.request

def download_file(url: str, dest_path: str):
    print(f"Downloading traffic video from:\n  {url}")
    print(f"Saving to: {dest_path}")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    req = urllib.request.Request(url, headers=headers)
    
    with urllib.request.urlopen(req) as response, open(dest_path, "wb") as out_file:
        total_size = int(response.info().get("Content-Length", 0))
        downloaded = 0
        chunk_size = 1024 * 1024  # 1 MB chunks
        
        while True:
            chunk = response.read(chunk_size)
            if not chunk:
                break
            out_file.write(chunk)
            downloaded += len(chunk)
            if total_size > 0:
                percent = downloaded / total_size * 100
                print(f"\rProgress: {downloaded / (1024*1024):.1f} MB / {total_size / (1024*1024):.1f} MB ({percent:.1f}%)", end="", flush=True)
            else:
                print(f"\rProgress: {downloaded / (1024*1024):.1f} MB", end="", flush=True)
    print("\nDownload complete!")

if __name__ == "__main__":
    os.makedirs("data", exist_ok=True)
    
    # Pexels 720p Urban Highway Traffic Clip (busy continuous multi-lane traffic)
    dest_path = "data/busy_traffic.mp4"
    urls = [
        "https://videos.pexels.com/video-files/854724/854724-hd_1280_720_25fps.mp4",
        "https://raw.githubusercontent.com/DeGirum/PySDKExamples/main/images/Traffic.mp4",
        "https://videos.pexels.com/video-files/2103099/2103099-hd_1280_720_30fps.mp4",
    ]
    
    for url in urls:
        try:
            print(f"\nAttempting download from: {url}")
            download_file(url, dest_path)
            # Verify downloaded video length
            import cv2
            cap = cv2.VideoCapture(dest_path)
            frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
            dur = frames / fps if fps > 0 else 0
            cap.release()
            print(f"Verified video: {frames} frames, {dur:.1f}s duration.")
            if frames > 150:
                print("Successfully acquired high-duration traffic video!")
                break
        except Exception as e:
            print(f"Failed to download {url}: {e}")

