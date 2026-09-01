import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
console.log('Runtime GEMINI_MODEL:', process.env.GEMINI_MODEL || 'gemini-3.6-flash');
console.log('API Key Present:', Boolean(apiKey));

async function main() {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const modelId = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
    
    // Attempt a lightweight call to test model availability
    const response = await ai.models.generateContent({
      model: modelId,
      contents: 'Respond with OK'
    });

    console.log(`[MODEL CHECK] Model "${modelId}" SUCCESS:`, response.text?.trim());
    console.log('MODEL_SUPPORTED = PASS');
  } catch (err) {
    console.error(`[MODEL CHECK] Model "${process.env.GEMINI_MODEL}" FAILED:`, err.message || err);
    
    // Attempt listing available models
    try {
      const ai = new GoogleGenAI({ apiKey });
      const list = await ai.models.list();
      console.log('Available models:', list.models?.map(m => m.name));
    } catch (listErr) {
      console.error('Failed to list models:', listErr.message || listErr);
    }
  }
}

main();
