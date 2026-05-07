import { GoogleGenAI, Type } from "@google/genai";
import { Dimensions, UnitSystem } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface ExtractedFormworkData {
  length?: number;
  height?: number;
  thickness?: number;
  kickerHeight?: string;
  formworkType?: string;
  strikeTime?: string;
  isComplex?: boolean;
}

export async function analyzeDrawing(imageBase64: string): Promise<ExtractedFormworkData | null> {
  const prompt = `You are a specialist Formwork Engineer. Analyze this construction drawing.
    Extract:
    1. Dimensions: Length (m), Height (m), Thickness (m).
    2. Kicker: Look for 75mm or 100mm kickers.
    3. Type: Identify system (Phenolic Plywood, Doka, Peri, Traditional).
    4. Strike Time: Search general notes for minimum striking period.
    5. Complexity: Identify circular columns, tapered walls, or non-linear shapes.
    
    Return JSON:
    {
      "length": number, 
      "height": number,
      "thickness": number,
      "kickerHeight": "string",
      "formworkType": "string",
      "strikeTime": "string",
      "isComplex": boolean
    }`;

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
            length: { type: Type.NUMBER },
            height: { type: Type.NUMBER },
            thickness: { type: Type.NUMBER },
            kickerHeight: { type: Type.STRING },
            formworkType: { type: Type.STRING },
            strikeTime: { type: Type.STRING },
            isComplex: { type: Type.BOOLEAN }
          }
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Advanced analysis failed:", error);
    return null;
  }
}

export async function compareSiteToDrawing(drawingBase64: string, photoBase64: string): Promise<string> {
  const prompt = `Compare this engineering drawing (Image 1) to the actual site photo of erected formwork (Image 2).
    
    Technical Audit Checklist:
    - Does tie-bar spacing match the spec?
    - Is the bracing configuration consistent with the drawing?
    - Are the kicker heights correct?
    
    Provide a professional assessment. If everything matches, start with "VERIFIED: MATCHES SPEC". 
    If not, flag as "ENGINEERING DISCREPANCY" and explain why.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { data: drawingBase64.split(',')[1], mimeType: "image/jpeg" } },
            { inlineData: { data: photoBase64.split(',')[1], mimeType: "image/jpeg" } }
          ]
        }
      ]
    });
    return response.text;
  } catch (error) {
    console.error("Comparison failed:", error);
    return "Verification service error.";
  }
}

export async function visualAudit(imageBase64: string, boqSummary: string): Promise<string> {
  const prompt = `Compare this site photo of a formwork/steel fixing setup with the following BOQ summary:
    BOQ SUMMARY:
    ${boqSummary}
    
    The Task: Identify any obvious discrepancies or safety concerns. 
    Examples: 
    - "Warning: Photo shows single-sided shutters but BOQ is for double-sided."
    - "Alert: Reinforcement density appears lower than calculated."
    - "Note: Wall thickness in photo seems significantly different from BOQ."
    
    Provide a concise, professional assessment.`;

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
    console.error("Audit failed:", error);
    return "Audit service currently unavailable.";
  }
}
