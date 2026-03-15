import asyncio
import json
import base64
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.adk.agents.live_request_queue import LiveRequestQueue
from google.adk.agents.run_config import RunConfig, StreamingMode
from google.genai import types
import os

from agent import root_agent 

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()
APP_NAME = "saga-engine"

session_service = InMemorySessionService()
runner = Runner(app_name=APP_NAME, agent=root_agent, session_service=session_service)

@app.websocket("/ws/{user_id}/{session_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str, session_id: str):
    await websocket.accept()
    logger.info(f"Connected: {user_id} | Session: {session_id}")
    
    # 1. ENSURE SESSION EXISTS
    # This block is critical. If this fails, runner.run_live will fail.
    try:
        await session_service.create_session(
            app_name=APP_NAME, 
            user_id=user_id, 
            session_id=session_id
        )
        logger.info(f"Session {session_id} initialized.")
    except Exception as e:
        # If it already exists, that's fine, just log and continue
        logger.info(f"Session notice: {e}")

    # 2. INITIALIZE PERSISTENT QUEUE
    # Moving this outside the loop keeps the connection "hot"
    live_request_queue = LiveRequestQueue()

    async def upstream():
        try:
            while True:
                data = await websocket.receive_text()
                msg = json.loads(data)
                
                # Manual Reset
                if msg.get("control") == "CLEAR_STORY":
                    logger.info("Resetting queue...")
                    # We don't return here, we just continue or handle logic
                    continue 

                ri = msg.get("realtime_input", {})
                if "media_chunks" in ri:
                    for chunk in ri["media_chunks"]:
                        if chunk.get("data"):
                            audio_bytes = base64.b64decode(chunk["data"])
                            live_request_queue.send_realtime(
                                types.Blob(mime_type="audio/pcm;rate=16000", data=audio_bytes)
                            )
                
                if ri.get("turn_complete"):
                    live_request_queue.send_content(
                        types.Content(role="user", parts=[types.Part(text="")])
                    )
        except WebSocketDisconnect:
            logger.info("Upstream: Client disconnected.")
        except Exception as e:
            logger.error(f"Upstream error: {e}")
        finally:
            live_request_queue.close()

    async def downstream():
        config = RunConfig(streaming_mode=StreamingMode.BIDI, response_modalities=["AUDIO"])
        try:
            # This generator stays open as long as the queue is open
            async for event in runner.run_live(
                user_id=user_id, 
                session_id=session_id, 
                live_request_queue=live_request_queue, 
                run_config=config
            ):
                await websocket.send_json(event.model_dump(mode='json', exclude_none=True))
        except Exception as e:
            logger.error(f"Downstream error: {e}")

    # 3. START THE ENGINES
    # Using gather here runs both until the connection is broken or queue is closed
    try:
        await asyncio.gather(upstream(), downstream())
    except Exception as e:
        logger.error(f"Session Loop Error: {e}")
    finally:
        logger.info(f"Cleaning up connection for {user_id}")
        if not live_request_queue.close:
            live_request_queue.close()
        try:
            await websocket.close()
        except:
            pass
        
port = int(os.environ.get("PORT", 8000))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=port)