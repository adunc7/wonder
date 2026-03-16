# Agent Wonder Engine 🚀

A real-time, bi-directional (BIDI) AI agent powered by **Google ADK** and **Gemini Live API**.

## 🏗 Architecture
- **Frontend:** Next.js 
- **Backend:** FastAPI on **Google Cloud Run**
- **AI Orchestration:** Google Agent Development Kit (ADK)
- **Storage:** Google Cloud Storage (GCS) for generated assets

## 🛠 Setup & Installation

### Backend
1. `cd adk-streaming/app`
2. `pip install -r requirements.txt`
3. `python main.py`

### Frontend
1. `cd agent-ui`
2. `npm install`
3. `npm run dev`

## ☁️ Deployment
This project is configured for **Google Cloud Platform**.
- Backend runs on **Cloud Run** with a WebSocket enabled entry point.
- Assets are persisted in a **GCS Bucket**.
