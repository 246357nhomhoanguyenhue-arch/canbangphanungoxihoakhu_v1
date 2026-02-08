
import { GoogleGenAI, Type } from "@google/genai";
import { RedoxStepData } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function analyzeRedoxEquation(equation: string): Promise<RedoxStepData> {
  const prompt = `Phân tích phương trình phản ứng oxi hóa khử sau và cung cấp các bước cân bằng theo phương pháp thăng bằng electron: "${equation}".
  Trả về kết quả dưới định dạng JSON.
  Lưu ý quan trọng cho Bước 2:
  - Quá trình Oxi hóa (Oxidation process): BẮT BUỘC viết số electron nhường ở bên PHẢI dấu mũi tên (ví dụ: Zn -> Zn2+ + 2e). Không được viết bên trái với dấu trừ.
  - Quá trình Khử (Reduction process): Viết số electron nhận ở bên TRÁI dấu mũi tên (ví dụ: S+6 + 2e -> S+4).
  
  Các yêu cầu khác:
  - Xác định các nguyên tố thay đổi số oxi hóa.
  - Tính toán hệ số (phương pháp bội chung nhỏ nhất).
  - Cung cấp các hệ số cân bằng cuối cùng. Nếu hệ số là 1, hãy trả về 1 trong mảng.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          originalEquation: { type: Type.STRING },
          compoundsLeft: { type: Type.ARRAY, items: { type: Type.STRING } },
          compoundsRight: { type: Type.ARRAY, items: { type: Type.STRING } },
          elementsChanging: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                symbol: { type: Type.STRING },
                leftState: { type: Type.NUMBER },
                rightState: { type: Type.NUMBER },
                compoundLeft: { type: Type.STRING },
                compoundRight: { type: Type.STRING },
              },
              required: ["symbol", "leftState", "rightState", "compoundLeft", "compoundRight"]
            }
          },
          reducingAgent: { type: Type.STRING },
          oxidizingAgent: { type: Type.STRING },
          oxidationProcess: { type: Type.STRING, description: "Format: A -> B + ne" },
          reductionProcess: { type: Type.STRING, description: "Format: A + ne -> B" },
          multiplierOx: { type: Type.NUMBER },
          multiplierRed: { type: Type.NUMBER },
          balancedCoefficients: { type: Type.ARRAY, items: { type: Type.NUMBER } },
        },
        required: [
          "originalEquation", "compoundsLeft", "compoundsRight", 
          "elementsChanging", "reducingAgent", "oxidizingAgent", 
          "oxidationProcess", "reductionProcess", "multiplierOx", 
          "multiplierRed", "balancedCoefficients"
        ]
      }
    }
  });

  return JSON.parse(response.text);
}
