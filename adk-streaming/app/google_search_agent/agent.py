from google.adk.agents import Agent, LlmAgent
from google.adk.tools import ToolContext, google_search  # Import the tool
from google.adk.tools import load_artifacts
import google.genai.types as types
from google import genai
from google.genai import types

import os 
from dotenv import load_dotenv

#Goolge cloud storage imports 
from google.cloud import storage 
import datetime
import asyncio

import io 
import wave
import re 
import time # Import time for sleeping
from google.genai import types
import json

import time
import asyncio



load_dotenv()  # Load environment variables from .env file, if you have one

BUCKET_NAME = "test-bucket-141"

#api_key = os.getenv("GOOGLE_API_KEY")


#MODELS 
IMG_MODEL = "imagen-4.0-fast-generate-001"  #"imagen-4.0-generate-001'" #"imagen-3.0-generate-002"
#VIDEO_MODEL = "veo-3.1-fast-generate-001"




#client = genai.Client(
#    vertexai = True ,
#    project=os.getenv("GOOGLE_CLOUD_PROJECT"), 
#    location=os.getenv("GOOGLE_CLOUD_LOCATION")
#)



client = genai.Client(
    vertexai = True ,
    project = "gemini-challenge-488717",
    location="us-central1"
)

#for m in client.models.list():
#    print(m.name)

def create_story(prompt: str) -> dict:
    """Creates a story based on a given prompt.

    Args:
        prompt (str): The prompt to use for creating the story.

    Returns:
        dict: A dictionary containing the status and the generated story or an error message.
    """
    #dic: status and result 
    if not prompt:
        return {
            "status": "error",
            "error_message": "Prompt is required to create a story.",
        }

    return {
        "status": "success",
        "story": f"Once upon a time, there was a story about '{prompt}'. It was an amazing tale!",
    }




# --- TOOL 1: HERO IMAGE GENERATION ---
import datetime
from google.cloud import storage
from google.genai import types

async def generate_main_hero(prompt: str, tool_context: "ToolContext"):
    """
    Establish the look and feel. Saves to a new story folder.
    """
    # Create the 'Folder ID'
    story_id = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    
    print(f"DEBUG: Generating Hero for Story ID: {story_id}")

    response = client.models.generate_images(
        model=IMG_MODEL,
        prompt=f"Cinematic hero character/environment reference: {prompt}",
        config={"number_of_images": 1}
    )

    if not response.generated_images:
        return {"status": "failed", "error": "Hero generation failed."}

    hero_bytes = response.generated_images[0].image.image_bytes
    
    # Path: "20260308_1200/hero.png"
    hero_path = f"{story_id}/hero.png"

    try:
        storage_client = storage.Client()
        bucket = storage_client.bucket(BUCKET_NAME)
        blob = bucket.blob(hero_path)
        blob.upload_from_string(hero_bytes, content_type="image/png")

        return {
            "status": "success",
            "story_id": story_id,
            "hero_path": hero_path,
            "message": f"Hero image created in folder {story_id}."
        }
    except Exception as e:
        return {"status": "failed", "error": str(e)}
    




async def generate_consistent_story_images(story_text: str, hero_filename: str, story_id: str):
    """
    Generates images using Hero image generated from generate_image as a character reference.
    """
    # 1. Parsing sentences
    sentence_pattern = r'[^.!?]+[.!?]+'
    sentences = [s.strip() for s in re.findall(sentence_pattern, story_text) if s.strip()]
    if not sentences: sentences = [story_text]

    storage_client = storage.Client()
    bucket = storage_client.bucket(BUCKET_NAME)

    # 2. Fetch the Hero image from GCS to use as reference
    hero_blob = bucket.blob(hero_filename)
    hero_bytes = hero_blob.download_as_bytes()
    # Create the 'Part' that Gemini can understand
    hero_part = types.Part.from_bytes(data=hero_bytes, mime_type="image/png")

    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    results = []

    for i, sentence in enumerate(sentences, 1):
        try:
            # 3. Generate content with IMAGE modality
            # We pass [hero_part, prompt] to maintain character consistency
            response = client.models.generate_content(
                model="gemini-2.5-flash-image",
                contents=[
                    hero_part, 
                    f"Storyboard panel: {sentence}. Use the character from the image for consistency."
                ],
                config=types.GenerateContentConfig(
                    response_modalities=["IMAGE"],
                    image_config=types.ImageConfig(aspect_ratio="16:9")
                )
            )

            # 4. Extract and Upload
            for part in response.candidates[0].content.parts:
                if part.inline_data:
                    image_bytes = part.inline_data.data
                    filename = f"{story_id}/images/story_image_{timestamp}_v{i}.png"

                    bucket.blob(filename).upload_from_string(image_bytes, content_type="image/png")
                    results.append({"sentence": sentence, "filename": filename})
                    break # Move to next sentence once image is found
            
            # Rate limiting safety for free tier
            time.sleep(10) 


        except Exception as e:
            print(f"Error on panel {i}: {e}")
            continue

    return {"status": "success", "images": results}



# --- TOOL 2: PARSE & SEQUENTIAL GENERATION ---


def save_text_to_file(content: str, story_id: str) -> dict:
    """
    Saves text to a local directory organized by story_id.
    """
    try:
        # Path: "saved_stories/TIMESTAMP/story.txt"
        output_dir = os.path.join("saved_stories", story_id)
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
            
        file_path = os.path.join(output_dir, "story_output.txt")
        
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
            
        return {
            "status": "success",
            "local_path": os.path.abspath(file_path)
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}



def prepare_story_queue(story_text: str, story_id: str):
    """
    Parses the story and saves each sentence as a separate TXT file in GCS.
    This acts as the 'Input Queue' for the image generator.
    """
    # 1. Split into sentences
    sentences = [s.strip() for s in re.split(r'(?<=[.!?]) +', story_text) if s.strip()]
    
    storage_client = storage.Client()
    bucket = storage_client.bucket(BUCKET_NAME)
    
    uploaded_files = []
    
    # 2. Save each sentence as a unique file
    for i, sentence in enumerate(sentences):
        # Path: TIMESTAMP/queue/panel_00.txt
        blob_path = f"{story_id}/queue/panel_{i:02d}.txt"
        blob = bucket.blob(blob_path)
        blob.upload_from_string(sentence, content_type="text/plain")
        uploaded_files.append(blob_path)
        
    return {
        "status": "success",
        "story_id": story_id,
        "total_panels": len(sentences),
        "queue_paths": uploaded_files,
        "instructions": "Queue prepared. Now trigger the sequential worker."
    }




#-------------------------------------------








async def generate_expressive_speech(text_with_emotion: str, story_id: str):
    """
    Converts text to speech and saves the .wav to the story folder in GCS.
    """
    try:
        # Path: "TIMESTAMP/narration.wav"
        filename = f"{story_id}/narration.wav"

        response = client.models.generate_content(
            model="gemini-2.5-flash-preview-tts",
            contents=text_with_emotion,
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name='Kore')
                    )
                ),
            )
        )

        audio_data = response.candidates[0].content.parts[0].inline_data.data

        buffer = io.BytesIO()
        with wave.open(buffer, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(24000)
            wf.writeframes(audio_data)
        
        buffer.seek(0)

        storage_client = storage.Client()
        bucket = storage_client.bucket(BUCKET_NAME)
        blob = bucket.blob(filename)
        blob.upload_from_file(buffer, content_type="audio/wav")

        return {
            "status": "success",
            "audio_path": filename,
            "gcs_path": f"gs://{BUCKET_NAME}/{filename}"
        }
    except Exception as e:
        return {"status": "failed", "error": str(e)}



def upload_story_to_cloud(story_text: str, story_id: str) -> dict:
    """
    Saves the story text to GCS inside the specific story folder.
    """
    try:
        storage_client = storage.Client()
        bucket = storage_client.bucket(BUCKET_NAME)
        
        # Path: "TIMESTAMP/story.txt"
        filename = f"{story_id}/story.txt"
        
        blob = bucket.blob(filename)
        blob.upload_from_string(story_text, content_type="text/plain")
        
        return {
            "status": "success",
            "story_id": story_id,
            "filename": filename,
            "gcs_path": f"gs://{BUCKET_NAME}/{filename}"
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}





#import datetime

#def interactive_continuation(story_text: str, story_id: str) -> dict:
#    """
#    Checkpoint tool that generates a NEW subfolder path for the next chapter.
#    """
#    if not story_text:
#        return {"status": "error", "message": "Story text is required."}

    # 1. Generate a NEW timestamp for this specific chapter
#    chapter_ts = datetime.datetime.now().strftime("%H%M%S")
    
    # 2. Define the NEW path (e.g., 20260310_120000/chapter_120501)
    # This keeps the original story_id as the 'Root'
#    new_chapter_id = f"{story_id}/chapter_{chapter_ts}"

    # 3. Always reference the hero.png in the ROOT folder
#    hero_image_path = f"gs://{BUCKET_NAME}/{story_id}/hero.png"

#    return {
#        "status": "awaiting_user_input",
#        "next_chapter_id": new_chapter_id, # The Agent MUST use this for new uploads
#        "root_story_id": story_id,          # The Agent MUST use this for hero.png
#        "last_context": story_text[-100:], 
#        "visual_anchor": hero_image_path,
#        "instructions_for_agent": (
#            "Ask the user if they want to continue. If they say yes: "
#            "1. Use 'next_chapter_id' as the story_id for all NEW uploads. "
#            "2. Use 'root_story_id' to find the 'hero.png' for visual consistency. "
#            "3. Ask for creative input for the next scene."
#            "4. Do NOT regenerate the new hero image."
#        )
#    }



from google.adk.tools import FunctionTool

root_agent = Agent(
    name="story_agent", 
    model="gemini-live-2.5-flash-native-audio",
    description="Agent to create a story based on a given prompt.",
    instruction="""You are a creative storyteller. Listen for the user's prompt. 
    1. First, write a detailed and engaging story based on the user's prompt in less than 50 words. FEEDBACK: VERBALLY Speak the story. Tell the user, "Your story is on its way. You can explore other stories in the console in the meantime!"
    2. Second, take the FULL text of the story you just wrote and save it using 'save_text_to_file'.
    3. Third, generate a main image that captures the essence of the story using 'generate_main_hero' and save it to Google Cloud Storage in the story_id folder. FEEDBACK: Tell the user, "I'm generating  a main image! I can't wait for us to dive deep into this adventure!"
    4. Call prepare_story_queue to break the story into sentences and save each sentence as a separate TXT file in GCS. This will create an input queue for image generation. FEEDBACK: Tell the user a joke while they wait. After the joke, sing a song about the prompt.
    5. Fourth, call generate_consistent_story_images to generate a storyboard panel for each sentence using the hero image as a reference for character consistency. "I'm generating more images, so that we have a truly immersive experience!" 
    6. Sixth, create an expressive audio narration of the story using 'generate_expressive_speech' and save it to Google Cloud Storage. FEEDBACK: Tell the user, "I'm creating the story's narration file, your interactive experience is on it's way!" 
    7. Seventh, upload the saved story to Google Cloud Storage using 'upload_story_to_cloud' for long-term storage.
    8. Finally, say "Your story is complete!"   
    """,
  
  
   
    tools=[create_story,generate_main_hero, prepare_story_queue, generate_consistent_story_images,generate_expressive_speech,save_text_to_file, upload_story_to_cloud],
)
    #Users can optionally enable generate_video in the instruction set, but it is currently commented out in the tools. 
    #7. Fifth, generate a video based on the main image using 'generate_video' and store in Google Cloud Storage.

