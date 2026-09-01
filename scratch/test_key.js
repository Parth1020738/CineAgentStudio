import { GoogleGenAI } from '@google/genai';

const apiKey = 'AIzaSyA9EQcH1AwLnrmywZu_dGcSTWCqeadvJg4';

async function main() {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const list = await ai.models.list();
    console.log('SUCCESS with AIza key! Available models:');
    for await (const m of list) {
      console.log(' -', m.name);
    }
  } catch (err) {
    console.error('AIza key FAILED:', err.message || err);
  }
}

main();
