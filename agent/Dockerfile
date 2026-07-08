FROM python:3.12-slim

# System deps for audio/native model runtime.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/

# Download the turn-detector / VAD model weights into the image so the first
# job doesn't pay for it at runtime.
RUN python src/main.py download-files

# No inbound ports needed — the worker registers OUTBOUND to LiveKit.
# (Optional) expose the health-check port for monitoring only:
# EXPOSE 8081

CMD ["python", "src/main.py", "start"]
