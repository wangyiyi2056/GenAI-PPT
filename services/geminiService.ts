import { GoogleGenAI, Type, Schema, GenerateContentResponse } from "@google/genai";
import { SlideContent, SlideLayout, OutlineItem } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Helper for Rate Limiting ---

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function callWithRetry<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isRateLimit = error?.status === 429 || error?.code === 429 || error?.message?.includes('429') || error?.message?.includes('quota');
    
    if (retries > 0 && isRateLimit) {
      console.warn(`Rate limit hit. Retrying in ${delay}ms...`);
      await wait(delay);
      return callWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

// --- Schemas ---

const outlineSchema: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Title of the slide (or Markdown header). Use (1/2), (2/2) for splits." },
      description: { type: Type.STRING, description: "The raw content for this section. Must be EXACT content from source." }
    },
    required: ["title", "description"]
  }
};

const slideSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    subtitle: { type: Type.STRING },
    bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
    columnLeft: { type: Type.ARRAY, items: { type: Type.STRING } },
    columnRight: { type: Type.ARRAY, items: { type: Type.STRING } },
    quote: { type: Type.STRING },
    author: { type: Type.STRING },
    statistic: { type: Type.STRING },
    description: { type: Type.STRING },
    code: { type: Type.STRING, description: "The source code string without markdown backticks" },
    language: { type: Type.STRING, description: "The programming language" },
    imagePrompt: { type: Type.STRING, description: "A detailed English prompt to generate an illustration for this slide if layout is IMAGE_TEXT." },
    speakerNotes: { type: Type.STRING },
    layout: { 
      type: Type.STRING, 
      enum: ["TITLE", "BULLETS", "TWO_COLUMN", "QUOTE", "BIG_NUMBER", "CODE", "IMAGE_TEXT"] 
    }
  },
  required: ["title", "layout", "speakerNotes"]
};

// --- Functions ---

export const generateOutline = async (topic: string, isFileContext: boolean = false): Promise<OutlineItem[]> => {
  const prompt = isFileContext 
    ? `You are a strict content parser converting a document into presentation slides.
       
       RULES:
       1. NO SUMMARIZATION: You must preserve the exact technical details, code examples, and explanations from the source text. Do not shorten them.
       2. SEGMENTATION: Break the text into slides based on headers (#, ##).
       3. PAGINATION (CRITICAL): If a section is long (more than 150 words or contains a long code block), split it into multiple slides.
          - Label them "Title (Part 1)", "Title (Part 2)".
          - When splitting, ensure CONTINUITY. Do not cut a sentence in half. Finish the sentence on the current slide before starting the next.
          - Do not split inside a small code block. If a code block is huge, you may split it, but prefer keeping it whole.
       4. CODE AWARENESS: Identify sections that contain code blocks.
       5. RAW CONTENT: The 'description' field must contain the FULL text/code for that section so the slide generator has the complete context.` 
    : `Create a comprehensive presentation outline for the topic: "${topic}". The outline should have 5-8 slides.`;

  const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt + (isFileContext ? `\n\n--- DOCUMENT CONTENT ---\n${topic}` : ""),
    config: {
      responseMimeType: "application/json",
      responseSchema: outlineSchema,
      systemInstruction: "You are an expert presentation designer."
    }
  }));

  if (!response.text) throw new Error("No response from AI");
  return JSON.parse(response.text) as OutlineItem[];
};

export const generateSlideContent = async (outlineItem: OutlineItem, theme: string): Promise<Omit<SlideContent, 'id'>> => {
  const prompt = `Generate content for a single presentation slide based on the provided Raw Content.
  
  Slide Title: ${outlineItem.title}
  Raw Content: ${outlineItem.description}
  Presentation Theme: ${theme}
  
  INSTRUCTIONS:
  1. Analyze the 'Raw Content'.
  2. LAYOUT SELECTION:
     - Check if the content contains a code block (wrapped in \`\`\` or obvious programming code).
     - IF CODE:
        - Set 'layout' to 'CODE'.
        - Extract code to 'code', language to 'language'.
        - Put context in 'description'.
     - IF NO CODE:
        - VISUAL OPPORTUNITY: Does this content describe a physical object, a scene, a concept that benefits from visualization, or a specific person? 
          - IF YES: Set 'layout' to 'IMAGE_TEXT'. Provide a 'bullets' array with key points AND an 'imagePrompt' (detailed English description for an AI image generator, e.g., "A futuristic city skyline with neon lights, photorealistic, 8k").
          - IF NO: 
            - Quote? Use 'QUOTE'.
            - Big stat? Use 'BIG_NUMBER'.
            - Comparison? Use 'TWO_COLUMN'.
            - Default: 'BULLETS'.
  
  3. CONTENT FIDELITY:
     - Do not hallucinate. Use the provided Raw Content.
  
  Return the JSON matching the schema.`;

  const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: slideSchema,
    }
  }));

  if (!response.text) throw new Error("No response from AI");
  const data = JSON.parse(response.text);
  
  return data as Omit<SlideContent, 'id'>;
};

export const regenerateSlide = async (currentSlide: SlideContent, instruction: string): Promise<Omit<SlideContent, 'id'>> => {
  const prompt = `Update this slide based on the user's instruction.
  
  Current Slide JSON:
  ${JSON.stringify(currentSlide)}
  
  User Instruction: "${instruction}"
  
  Return the full updated slide JSON object including the layout.`;

  const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: slideSchema,
    }
  }));

  if (!response.text) throw new Error("No response from AI");
  return JSON.parse(response.text);
};

export const parseFileToText = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
};

export const generateImage = async (prompt: string): Promise<string> => {
  // Uses gemini-2.5-flash-image for generation
  const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { text: prompt }
      ]
    }
  }));

  // Extract inlineData
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData && part.inlineData.data) {
       return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }
  
  throw new Error("No image data found in response");
};