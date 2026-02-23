
import { GoogleGenAI, Type } from "@google/genai";
import { Character, Scene, ArtStyle } from "../types";

export async function describeCharacterFromImage(base64Image: string, mimeType: string): Promise<Partial<Character>> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        {
          inlineData: {
            data: base64Image,
            mimeType: mimeType,
          },
        },
        {
          text: `Phân tích nhân vật trong ảnh để làm prompt AI chuyên sâu. Trả về JSON tiếng Việt mô tả chi tiết diện mạo.`,
        },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          face: { type: Type.STRING, description: "Chi tiết khuôn mặt" },
          hair: { type: Type.STRING, description: "Kiểu tóc và màu sắc" },
          outfit: { type: Type.STRING, description: "Trang phục cụ thể" },
          personality: { type: Type.STRING, description: "Thần thái nhân vật" },
          style: { type: Type.STRING, description: "Phong cách nghệ thuật phù hợp" }
        },
        required: ["face", "hair", "outfit"]
      }
    }
  });

  try {
    const data = JSON.parse(response.text || "{}");
    return {
      appearance: { face: data.face || "", hair: data.hair || "", body: "", lockedKeywords: "" },
      outfit: data.outfit || "", personality: data.personality || "", style: data.style || ""
    };
  } catch (e) {
    return {};
  }
}

export async function analyzeScript(script: string, targetScenes: number, isDetailed: boolean = false): Promise<Partial<Scene>[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const instruction = isDetailed 
    ? `Bạn là đạo diễn Storyboard chuyên nghiệp. Kịch bản này được thiết kế để đọc Voice-over (giọng đọc). 
       NHIỆM VỤ: Chia kịch bản thành đúng ${targetScenes} cảnh.
       QUY TẮC VÀNG: 
       - Mỗi cảnh đại diện cho 8 giây voice-over tiếp theo trong dòng thời gian.
       - Nội dung mô tả của Cảnh N phải minh họa chính xác những gì đang được đọc trong kịch bản ở giây thứ ((N-1)*8) đến (N*8).
       - Hình ảnh phải bám sát câu chữ, hành động và cảm xúc của kịch bản tại đúng thời điểm đó để khi khớp voice-over, hình ảnh minh họa hoàn hảo cho lời nói.
       - Kết quả trả về là JSON array chứa nội dung mô tả hành động minh họa.`
    : `Hãy là một đạo diễn hình ảnh. Chia kịch bản sau thành đúng ${targetScenes} phân cảnh (scenes). 
       Mỗi cảnh cần có mô tả hành động, góc máy và ánh sáng điện ảnh. Trả về JSON array.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `${instruction}\nKịch bản: ${script}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            cameraAngle: { type: Type.STRING },
            lighting: { type: Type.STRING },
            durationSeconds: { type: Type.NUMBER }
          },
          required: ["description", "durationSeconds"]
        }
      }
    }
  });

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    return [];
  }
}

export async function generatePromptsForScenes(
  scenes: Scene[],
  characters: Character[],
  globalStyle?: ArtStyle,
  globalBackground?: string
): Promise<Scene[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Custom keyword mapping for better results
  let styleKeywords = globalStyle || 'Cinematic, hyper-realistic, 8k, highly detailed';
  if (globalStyle === 'Edo Period Fusion') {
    styleKeywords = 'Edo period style, Ukiyo-e fusion, modern manga lineart, warm cinematic lighting, historical Japanese setting, expressive faces, detailed textures, traditional Japanese art influence';
  }

  const hasCharacters = characters.length > 0;
  const charContext = hasCharacters 
    ? characters.map(c => `CHARACTER DEFINITION - ${c.name} (${c.token}): Face: ${c.appearance.face}, Hair: ${c.appearance.hair}, Wearing: ${c.outfit}. Personality: ${c.personality}`).join("\n")
    : "NO CHARACTERS PROVIDED. INSTRUCTIONS: Automatically identify the main protagonist in the script and create a consistent physical description for them across all prompts.";

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `You are a World-Class AI Prompt Engineer.
    
    ART STYLE: ${styleKeywords}
    GLOBAL SETTING: ${globalBackground || 'Vivid environments based on the scene context'}
    
    CHARACTERS DATABASE:
    ${charContext}

    SCENES LIST TO PROCESS:
    ${JSON.stringify(scenes.map(s => ({ id: s.id, desc: s.description, camera: s.cameraAngle, lighting: s.lighting })))}

    YOUR MISSION:
    1. Create an expert English prompt for each scene ID. 
    2. THE PROMPT MUST BE A SINGLE CONTINUOUS LINE (NO NEWLINES).
    3. Ensure the character looks the same in every prompt.
    4. Return ONLY a JSON array of objects: {id, generatedPrompt}.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            generatedPrompt: { type: Type.STRING }
          },
          required: ["id", "generatedPrompt"]
        }
      }
    }
  });

  try {
    const results = JSON.parse(response.text || "[]");
    return scenes.map(s => {
      const result = results.find((r: any) => r.id === s.id);
      return result ? { ...s, generatedPrompt: result.generatedPrompt } : s;
    });
  } catch (e) {
    return scenes;
  }
}

export async function generateScenePreview(prompt: string): Promise<string | null> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: { parts: [{ text: prompt }] },
    config: { imageConfig: { aspectRatio: "16:9", imageSize: "1K" } },
  });
  
  const candidate = response.candidates?.[0];
  if (!candidate?.content?.parts) return null;
  
  const part = candidate.content.parts.find(p => p.inlineData);
  return part?.inlineData?.data ? `data:image/png;base64,${part.inlineData.data}` : null;
}
