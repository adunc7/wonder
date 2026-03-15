import { Storage } from "@google-cloud/storage";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const storage = new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
    });

    const bucketName = process.env.GCS_BUCKET_NAME;
    if (!bucketName) {
      throw new Error("GCS_BUCKET_NAME environment variable is not set.");
    }
    const bucket = storage.bucket(bucketName);

    // 1. Fetch Root Sessions (Top-level folders)
    const [, , apiResponse] = await bucket.getFiles({ 
      delimiter: '/', 
      autoPaginate: false 
    });
    const prefixes: string[] = (apiResponse as any).prefixes || [];
    
    // Filter for current year and get the 5 most recent sessions
    const latestRoots = prefixes
      .filter(p => p.startsWith("2026"))
      .sort((a, b) => b.localeCompare(a))
      .slice(0, 5);

    // Helper: Parse folder assets (Text, Audio, Images)
    const parseFolder = async (path: string) => {
      const [files] = await bucket.getFiles({ prefix: path, delimiter: '/' });
      
      const sign = async (file: any) => {
        if (!file) return null;
        const [url] = await file.getSignedUrl({ 
          version: 'v4', 
          action: 'read', 
          expires: Date.now() + 3600 * 1000 
        });
        return url;
      };

      const findFile = (name: string) => files.find(f => f.name === `${path}${name}`);
      
      const storyFile = findFile("story.txt");
      const audioFile = findFile("narration.wav");
      const voiceReply = findFile("voice_reply.wav"); // New: Agent's direct response
      const heroFile = findFile("hero.png");

      let storyText = "";
      if (storyFile) {
        const [content] = await storyFile.download();
        storyText = content.toString();
      }

      // FETCH NESTED ASSETS
      const [imgFiles] = await bucket.getFiles({ prefix: `${path}images/` });
      const [queueFiles] = await bucket.getFiles({ prefix: `${path}queue/` });

      // Pairing Logic: images[i] -> texts[i]
      const sortedImages = imgFiles
        .filter(f => f.name.endsWith(".png"))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

      const sortedTexts = queueFiles
        .filter(f => f.name.endsWith(".txt"))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

      const panels = await Promise.all(
        sortedImages.map(async (img, index) => {
          const signedUrl = await sign(img);
          const txtFile = sortedTexts[index];
          let caption = "";
          
          if (txtFile) {
            const [content] = await txtFile.download();
            caption = content.toString();
          }
          
          return { 
            url: signedUrl, 
            caption: caption || null 
          };
        })
      );

      return {
        chapterId: path.split('/').filter(Boolean).pop() || "root",
        audioUrl: await sign(voiceReply || audioFile), // Prioritize the agent's voice reply
        heroUrl: await sign(heroFile),
        text: storyText,
        panels
      };
    };

    // 2. Build the full Narrative Tree
    const stories = await Promise.all(latestRoots.map(async (rootPath) => {
      const rootData = await parseFolder(rootPath);
      
      const [, , chapterResponse] = await bucket.getFiles({ 
        prefix: rootPath, 
        delimiter: '/', 
        autoPaginate: false 
      });
      const subPrefixes: string[] = (chapterResponse as any).prefixes || [];
      
      const chapterPaths = subPrefixes
        .filter(p => p.includes("chapter_"))
        .sort((a, b) => a.localeCompare(b));

      const subChapters = await Promise.all(chapterPaths.map(p => parseFolder(p)));

      return {
        rootId: rootPath.replace('/', ''),
        heroUrl: rootData.heroUrl, 
        chapters: [rootData, ...subChapters]
      };
    }));

    return NextResponse.json({ stories });
  } catch (error: any) {
    console.error("GCS Pipeline Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}