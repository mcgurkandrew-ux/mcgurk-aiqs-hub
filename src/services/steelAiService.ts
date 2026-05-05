import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const REBAR_WEIGHTS: Record<string, number> = {
  // Metric (kg/m)
  '8': 0.395,
  '10': 0.617,
  '12': 0.888,
  '16': 1.58,
  '20': 2.47,
  '25': 3.85,
  '32': 6.31,
  '40': 9.86,
  // US Imperial (lbs/ft)
  '#3': 0.376,
  '#4': 0.668,
  '#5': 1.043,
  '#6': 1.502,
  '#7': 2.044,
  '#8': 2.670,
  '#9': 3.400,
  '#10': 4.303,
  '#11': 5.313
};

export async function extractSteelSchedule(imageBase64: string) {
  const prompt = `You are a specialist Quantity Surveyor for McGurk Construction. 
  Extract the Reinforcement Schedule table from this drawing.
  Look for: Bar Mark, Type & Size (e.g. H12 or #4), Number of bars, and Length (mm, m, ft, or inches).
  
  Return as JSON: 
  {
    "items": [
      { "mark": "string", "typeSize": "string", "count": number, "length": number }
    ]
  }
  
  Handle US standards (e.g. #3, #4 rebar) and Metric (e.g. H12, R16).
  Return total length as a float (Meters if drawing is metric, Feet if drawing is US Imperial).`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { data: imageBase64.split(',')[1], mimeType: "image/jpeg" } }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  mark: { type: Type.STRING },
                  typeSize: { type: Type.STRING },
                  count: { type: Type.NUMBER },
                  length: { type: Type.NUMBER }
                }
              }
            }
          }
        }
      }
    });

    const data = JSON.parse(response.text);
    return data.items || [];
  } catch (error) {
    console.error("Steel extraction failed:", error);
    return [];
  }
}

export async function auditFixedSteel(imageBase64: string, expectedSchedule: string) {
  const prompt = `You are a site supervisor conducting a 'Reality Check' on fixed reinforcement.
  Compare this photo of fixed steel against the expected schedule:
  ${expectedSchedule}
  
  Task: 
  1. Count visible bars in a section.
  2. Estimate spacing between bars.
  3. Identify if spacing seems wider than specified (e.g. if 200mm is expected but looks like 300mm).
  4. Flag any missing chairs/spacers.
  
  Provide a concise 'Supervisor Warning' if discrepancies are found, or a 'Check Passed' if all looks correct.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { data: imageBase64.split(',')[1], mimeType: "image/jpeg" } }
          ]
        }
      ]
    });
    return response.text;
  } catch (error) {
    console.error("Steel audit failed:", error);
    return "Audit service error.";
  }
}

export const getWeightPerM = (typeSize: string): number => {
  if (typeSize.startsWith('#')) {
    const size = typeSize.split(' ')[0]; // Handle cases like "#4 bar"
    return REBAR_WEIGHTS[size] || 0;
  }
  const diameter = typeSize.replace(/[^0-9]/g, '');
  return REBAR_WEIGHTS[diameter] || 0;
};
