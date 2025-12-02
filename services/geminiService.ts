import { GoogleGenAI } from "@google/genai";

let ai: GoogleGenAI | null = null;

// Function to initialize or update the API key dynamically
export const setGeminiApiKey = (key: string) => {
  if (key) {
    ai = new GoogleGenAI({ apiKey: key });
  }
};

// Try to initialize immediately if env var is present (Dev mode)
// Note: In Vite, we check import.meta.env, but for compatibility we keep a check
try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env.API_KEY) {
        // @ts-ignore
        setGeminiApiKey(process.env.API_KEY);
    } else if ((import.meta as any).env && (import.meta as any).env.VITE_API_KEY) {
        setGeminiApiKey((import.meta as any).env.VITE_API_KEY);
    }
} catch (e) {
    // Environment variables might not exist in portable mode, ignore.
}

export const generateResponse = async (
  query: string,
  context: string,
  history: { role: string; parts: { text: string }[] }[]
): Promise<string> => {
  try {
    if (!ai) {
        throw new Error("API_KEY_MISSING");
    }

    const systemInstruction = `
      Eres Antelito, un asistente virtual con forma de globo de mensaje amarillo. Eres simpático, brillante y muy servicial.
      
      Tu objetivo es responder las preguntas del usuario basándote ESTRICTAMENTE en la "Biblioteca de Documentos" proporcionada.
      
      Reglas:
      1. La información proviene de varios archivos PDF o textos subidos por el usuario. Úsalos como tu única fuente de verdad.
      2. Si la respuesta se encuentra en los documentos, proporciónala de forma clara y concisa.
      3. Si la respuesta NO está en los documentos, di cortésmente que no ves eso en tu biblioteca actual, pero ofrece ayudar con otra cosa.
      4. Mantén una personalidad alegre y conversadora. ¡Te encanta leer y charlar!
      5. Usa formato (viñetas, negrita) para que las respuestas sean legibles.
      6. RESPONDE SIEMPRE EN ESPAÑOL.
      
      Biblioteca de Documentos (Contexto unificado):
      "${context}"
    `;

    // We use gemini-2.5-flash for speed and large context window capability
    const model = 'gemini-2.5-flash';

    const response = await ai.models.generateContent({
      model,
      config: {
        systemInstruction,
        temperature: 0.5, // Lower temperature for more accurate extraction from documents
      },
      contents: [
        ...history,
        {
            role: "user",
            parts: [{ text: query }]
        }
      ]
    });

    return response.text || "Ups, se me borraron las letras por un segundo. ¿Podrías repetirme la pregunta?";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    
    // Specific handling for missing key in Portable Mode
    if (error.message === "API_KEY_MISSING" || error.message?.includes('API key')) {
         return "🔑 **¡Falta la Llave!** \n\nPara funcionar en modo portátil, necesito que ingreses tu **API Key de Google** en la pantalla de inicio.";
    }

    if (error.status === 403 || error.message?.includes('PERMISSION_DENIED')) {
        return "🛑 **Llave Incorrecta** Parece que la API Key guardada no es válida. Por favor revísala.";
    }

    return "¡Pof! Mi burbuja se mareó un poco. Hubo un error de conexión con mi cerebro digital. Por favor inténtalo de nuevo.";
  }
};