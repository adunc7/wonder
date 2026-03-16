# Wonder  🗣️🎙️🎬🚀

## A voice-driven AI pipeline that converts spoken ideas into structured cinematic storyboards in a single interface
A real-time, bi-directional (BIDI) AI agent powered by **Google ADK**, **Gemini Live API** and **Gemini Models**.

Stories have been limited to <50 words, you can modify the code in the instructions on the root_agent to extend the word limit. 

## 🏗 Architecture
- **Frontend:** Next.js 
- **Backend:** FastAPI on **Google Cloud Run**
- **AI Orchestration:** **Google Agent Development Kit (ADK)**
- **Storage:** **Google Cloud Storage (GCS) for generated assets**

## 🤖 Models used in Agent 
-	"imagen-4.0-fast-generate-001" was used to generate the main image or cover image for the story. 
-	“gemini-2.5-flash-image”, Nano Banana was used to generate the subsequent images with interleaved output. Option exists to upgrade to Nano Banana 2. 
-	“gemini-2.5-flash-preview-tts” was used to generate the audio narration. 
-	“veo-3.1-fast-generate-001” has also been used in testing to create video generation from the main image.
-	Google Cloud Storage: Acts as the persistent "Memory Vault" for all generated assets, providing the frontend with signed URLs to display content back to the user.


## 🛠 Setup & Installation

Clone the github repository
cd your-repo-name

### Install Dependencies 

1.`python3.13 -m venv .venv`

2.`source .venv\Scripts\Activate.ps1`

### Backend
1. `cd adk-streaming/app/google_search_agent`
2. `pip install -r requirements.txt`
3. `uvicorn main:app --reload`

## Frontend
1. `cd my-agent-ui`
2. `npm install`
3. `npm run dev`

## 🔑 Environment Configuration

You will need to set up `.env` files in both the root of the `/google_search_agnet` and `/my-agent-ui` folders.

### Backend (`/google_search_agent/.env`)
```env
GOOGLE_API_KEY=your_gemini_api_key
GCP_PROJECT_ID=your_project_id
GCS_BUCKET_NAME=your_assets_bucket_name



### 🔑 Frontend Environment Configuration

You will need to set up `.env` files in both the root of the `/google_search_agenrt` and `/my-agent-ui` folders.

### Frontend (`/my-agent-ui/.env`)
```env
GOOGLE_CLOUD_PROJECT= "your_poject_id"
GOOGLE_CLOUD_LOCATION="your_location"
GCS_BUCKET_NAME="your_assets_bucket_name"
GOOGLE_APPLICATION_CREDENTIALS = "/secrets/key.json"
```

### 🔑 IAM Roles & Security
Ensure the Service Account used by Cloud Run has these specific roles assigned in the [GCP IAM Console](https://console.cloud.google.com/iam-admin/iam):

1. **Storage Object User** (`roles/storage.objectUser`)
2. **Service Account Token Creator** (`roles/iam.serviceAccountTokenCreator`)
3. **Vertex AI User** (`roles/aiplatform.user`)
4. **Vertex AI Service Agent** (`roles/aiplatform.user`)




## ☁️Deployment

This project is configured for **Google Cloud Platform**.
- Backend runs on **Cloud Run** with a WebSocket enabled entry point.
- Assets are persisted in a **GCS Bucket**.
- Deployment automated with Dockerfile - gcloud run deploy project-name --source . --region your-region --allow-unauthenticated --set-env-vars="PYTHONNUNBUFFERED =1, GOOGLE_GENAI_USE_VERTEXAI = TRUE"




## Usage 
1. Click "Initialize Engine"
2. Hold the Mic icon and greet the agent, release the button when finished.
3. The agent greets you initially with a request for a prompt.  
4. Hold the mic button and speak your request. When finished released the mic button. 
5. Speak your request.
6. The agent begins execution and will notify the user of updates.
7. "Your story is complete" - Reload the page to view the new story. 

## Troubleshooting
1. Reload the page
2. Create new session at top of screen
3. Wait 2-3 seconds.
4. Hold mic and request story.

## Screenshots 
![System Architecture](./images/Wonder_GIF.gif)

![System Architecture](./images/Image1.png)

![System Architecture](./images/Image2.png)

![System Architecture](./images/Wonder_wiz.gif)


