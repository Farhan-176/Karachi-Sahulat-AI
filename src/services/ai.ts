import { GoogleGenAI, Type } from "@google/genai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey });

const KARACHI_SAHULAT_INSTRUCTION = `You are "Karachi Sahulat AI", a hyper-local, street-smart digital assistant for the citizens of Karachi, Pakistan.
Your sole purpose is to provide immediate, actionable, and accurate information regarding the daily challenges in Karachi.

**CRITICAL DIRECTIVE ON DATA:**
You have access to real-time Google Search. You MUST actively use this tool to fetch the most up-to-date, live information regarding Karachi's traffic, weather, load-shedding schedules, water board (KWSC) updates, and local news. Do not rely solely on your pre-trained knowledge for current events.

**PERSONA & BEHAVIORAL RULES:**
1. **Local Context:** You intimately understand Karachi's geography (Districts: South, East, West, Central, Malir, Korangi, Keamari) and major arteries (Shahrah-e-Faisal, University Road, Lyari Expressway).
2. **Local Terminology:** Use terms familiar to locals naturally (e.g., "Load-shedding," "K-Electric / KE," "Water Tanker," "Nullah").
3. **High Utility, Low Fluff:** Your users are likely checking their phones while commuting or dealing with an outage. Be extremely concise. No long introductory paragraphs.
4. **Honesty:** If your real-time search cannot find a specific update for a micro-neighborhood (e.g., "Gulshan Block 13-D"), explicitly state that, but provide the general status for the broader district.

**REQUIRED OUTPUT FORMAT (ONLY FOR AREA/LOCATION/STATUS QUERIES):**
When a user asks about a specific area, location, or requests a status update on an issue in Karachi (traffic, power, water), you MUST structure your response using the following template. For general conversational questions about the app or non-location topics, do NOT use this template; just answer naturally and concisely.

📍 **Location/Topic:** [Detected Area, Route, or Utility]
🔴 / 🟡 / 🟢 **Live Status:** [A concise 1-2 sentence summary of the current situation based on your live search]
💡 **Actionable Advice:** [A practical recommendation, e.g., "Use Rashid Minhas Road instead" or "Lodge a complaint via KE Live App"]
`;

export async function getLiveAlerts() {
  const CACHE_KEY = "karachi_live_alerts_cache";
  const CACHE_DURATION = 1000 * 60 * 10; // 10 minutes

  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < CACHE_DURATION) {
        return {
          traffic: parsed.traffic,
          power: parsed.power
        };
      }
    }
  } catch (e) {
    // ignore cache parsing errors
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { role: "user", parts: [{ text: `Search for the very latest, real-time traffic alerts on major Karachi routes AND K-Electric (KE) load-shedding/power status.
Please return a JSON object with two fields:
{
  "traffic": "1-2 bullet points about traffic. If clear, write '🟢 All major routes are currently clear.'",
  "power": "1-2 bullet points about power. If stable, write '🟢 Power grid appears stable with routine load-shedding.'"
}
Be very concise.` }] }
      ],
      config: {
        temperature: 0.2,
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json"
      }
    });

    const raw = response.text || "{}";
    const data = JSON.parse(raw);
    const result = {
      traffic: data.traffic || "Traffic status currently unavailable.",
      power: data.power || "Power grid status currently unavailable."
    };

    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({
        ...result,
        timestamp: Date.now()
      }));
    } catch (e) {
      // ignore storage errors
    }

    return result;
  } catch (err: any) {
    console.error("Error fetching live alerts:", err);
    const errMsg = err?.message || JSON.stringify(err);
    if (errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("RESOURCE_EXHAUSTED")) {
       return {
         traffic: "⚠️ AI rate limit reached. Traffic updates temporarily paused.",
         power: "⚠️ AI rate limit reached. Power updates temporarily paused."
       };
    }
    return {
      traffic: "Traffic status currently unavailable.",
      power: "Power grid status currently unavailable."
    };
  }
}

export async function generateChatTitle(prompt: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: [
      { role: "user", parts: [{ text: `Create an ultra-short, highly descriptive title (1 to 4 words max) summarizing the following message.
Context: Karachi city, local issues like K-Electric load-shedding, traffic, water tankers, etc.
Format: Return ONLY the raw title without punctuation, quotes, or conversational filler. Capitalize properly.
Examples: 
- "Gulshan Water Tanker" 
- "Load Shedding Timings"
- "Shara-e-Faisal Traffic"

Message to summarize:
"${prompt}"` }] }
    ],
    config: {
      temperature: 0.1
    }
  });

  return response.text?.trim().replace(/^["']|["']$/g, '') || "New Consultation";
}

export async function askKarachiSahulat(history: {role: 'user' | 'model', parts: {text: string}[]}[], prompt: string) {
  const chat = ai.chats.create({
    model: "gemini-3.1-pro-preview",
    config: {
      systemInstruction: KARACHI_SAHULAT_INSTRUCTION,
      temperature: 0.5,
    },
    // We can't directly put history in ai.chats.create if it doesn't match the new SDK exactly.
    // Actually, in the new SDK:
    // ai.chats.create has `history` in the initialization if needed? Let's check documentation.
    // It's safer to just let the chat object be created and manage history via `sendMessage`.
  });
  
  // Wait, if we want to pass history, we should either set it when creating chat OR use generateContent directly.
  // Using generateContent with history:
  const contents = [...history, { role: "user", parts: [{text: prompt}]}];
  
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: contents as any,
    config: {
      systemInstruction: KARACHI_SAHULAT_INSTRUCTION,
      temperature: 0.5,
      tools: [{ googleSearch: {} }]
    }
  });

  return response.text;
}
