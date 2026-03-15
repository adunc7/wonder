# --- STAGE 1: Builder ---
# Use 3.13 to match your development environment exactly
FROM python:3.13-slim AS builder

WORKDIR /app

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install build tools 
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Install dependencies 
# Note: Using --user and a dedicated path is cleaner for multi-stage
RUN pip install --no-cache-dir --user -r requirements.txt


# --- STAGE 2: Runtime ---
FROM python:3.13-slim

WORKDIR /app

# Copy the installed site-packages from the builder
COPY --from=builder /root/.local /root/.local

# Ensure the local bin is in the PATH
ENV PATH=/root/.local/bin:$PATH
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# --- CRITICAL: Vertex AI Environment Variables ---
# This tells the Gemini SDK exactly where to look, fixing the 1008 "Model Not Found"
ENV GOOGLE_CLOUD_LOCATION="us-central1"
ENV GOOGLE_GENAI_USE_VERTEXAI="True"

# Copy your application code
COPY . .

# Expose the port (Cloud Run defaults to 8080)
EXPOSE 8080

# Run the application
CMD ["python", "main.py"]