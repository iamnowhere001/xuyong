import { GoogleGenAI, Type } from "@google/genai";
import { RenameRule } from "../types";

export const generateRuleFromPrompt = async (userPrompt: string): Promise<RenameRule | null> => {
  if (!process.env.API_KEY) {
    console.error("API_KEY is missing");
    return null;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `User wants to rename files. Create a renaming rule based on this request: "${userPrompt}".
      If the user wants to remove text, use replacement with empty string.
      If complex matching is needed, set useRegex to true and provide a valid javascript Regex string (without slash wrappers).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            find: { type: Type.STRING, description: "The string or regex pattern to find" },
            replace: { type: Type.STRING, description: "The string to replace with (empty if removing)" },
            useRegex: { type: Type.BOOLEAN, description: "Whether to use regex matching" },
            explanation: { type: Type.STRING, description: "Short explanation of what this rule does" }
          },
          required: ["find", "replace", "useRegex"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    
    if (result.find) {
      return {
        type: result.useRegex ? 'regex' : 'replace',
        find: result.find,
        replace: result.replace || '',
        useRegex: result.useRegex,
        isActive: true
      };
    }
    return null;

  } catch (error) {
    console.error("Error generating rule:", error);
    return null;
  }
};
