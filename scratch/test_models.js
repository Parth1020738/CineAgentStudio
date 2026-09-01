import { GoogleGenAI } from '@google/genai';

const apiKey = 'AIzaSyA9EQcH1AwLnrmywZu_dGcSTWCqeadvJg4';
const ai = new GoogleGenAI({ apiKey });

async function testModel(modelId) {
  try {
    const res = await ai.models.generateContent({
      model: modelId,
      contents: 'Hello, respond with OK'
    });
    console.log(`[TEST MODEL] ${modelId} -> SUCCESS: ${res.text?.trim()}`);
    return true;
  } catch (err) {
    console.log(`[TEST MODEL] ${modelId} -> FAILED: ${err.message}`);
    return false;
  }
}

async function main() {
  await testModel('gemini-3.6-flash-lite');
  await testModel('gemini-3.1-flash-lite');
  await testModel('gemini-3.6-flash');
}

main();
