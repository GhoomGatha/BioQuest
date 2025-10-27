import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Question, Language } from '../types';

const FALLBACK_API_KEY = process.env.API_KEY;

if (!FALLBACK_API_KEY) {
  console.warn("Fallback API_KEY environment variable not set. AI features will require user-provided key.");
}

const getStyleGuideline = (questionType?: string): string => {
    switch (questionType) {
        case 'Short Answer':
            return "For these Short Answer questions, create a mix of types: some asking for definitions, some for explanations of processes, and some for comparing/contrasting concepts.";
        case 'Multiple Choice':
            return "For these Multiple Choice questions, ensure the incorrect options (distractors) are plausible and related to the topic. Avoid trivial or obviously wrong answers.";
        case 'Fill in the Blanks':
            return "For these Fill in the Blanks questions, vary the sentence structure and the position of the blank (`____`).";
        case 'True/False':
            return "For these True/False questions, formulate statements that require careful consideration of the topic, not just simple fact recall.";
        default:
            return "";
    }
}

export const generateQuestionsAI = async (
  criteria: {
    class: number;
    chapter: string;
    marks: number;
    difficulty: string;
    count: number;
    questionType?: string;
    keywords?: string;
    generateAnswer?: boolean;
    wbbseSyllabusOnly: boolean;
    lang: Language;
  },
  existingQuestions: Question[],
  userApiKey?: string,
): Promise<Partial<Question>[]> => {
  const apiKey = userApiKey || FALLBACK_API_KEY;
  if (!apiKey) {
    throw new Error("API Key is not configured. Please add your own key in Settings to use AI features.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const languageMap = {
    en: 'English',
    bn: 'Bengali',
    hi: 'Hindi',
  };
  const targetLanguage = languageMap[criteria.lang] || 'English';

  const existingQuestionTexts = existingQuestions.map(q => `- ${q.text}`).join('\n');
  const shouldGenerateAnswer = criteria.generateAnswer || ['Multiple Choice', 'Fill in the Blanks', 'True/False'].includes(criteria.questionType || '');
  
  try {
    if (criteria.questionType === 'Image-based') {
      // Step 1: Generate question text, answer, and a specific prompt for the image model.
      const textGenPrompt = `
You are an expert biology teacher creating a question for an exam.
Your task is to generate a single JSON object containing "questionText", "answerText", and "imagePrompt".

**Instructions:**
1.  **questionText**: Create a biology question based on the criteria below. This question MUST refer to a diagram (e.g., "Identify the part labeled 'X'...", "Describe the process shown in the diagram...").
2.  **answerText**: Provide a concise, correct answer to the question. ${!shouldGenerateAnswer ? 'This field should be an empty string if an answer is not required.' : ''}
3.  **imagePrompt**: Write a clear and detailed prompt for an image generation AI. This prompt should describe the exact diagram needed to answer the question. It should be simple, biologically accurate, and include instructions for any necessary labels (e.g., "Label the nucleus with the letter 'A'.").
4.  All generated text MUST be in the **${targetLanguage}** language.

**Criteria for the Question:**
- Class: ${criteria.class}
- Topic: "${criteria.chapter}"
- Difficulty: ${criteria.difficulty}
- Marks: ${criteria.marks}

**Output Format:**
Return ONLY a single valid JSON object. Do not add any text before or after the JSON.
`;
      const responseSchema: any = {
          type: Type.OBJECT,
          properties: {
              questionText: { type: Type.STRING, description: "The biology question that requires a diagram." },
              imagePrompt: { type: Type.STRING, description: "A detailed prompt for an AI to generate the necessary diagram." },
          },
          required: ["questionText", "imagePrompt"],
      };

      if (shouldGenerateAnswer) {
          responseSchema.properties.answerText = { type: Type.STRING, description: "The answer to the question." };
          responseSchema.required.push("answerText");
      }

      const textResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: textGenPrompt,
          config: {
              responseMimeType: "application/json",
              responseSchema: responseSchema,
          },
      });

      const textResult = JSON.parse(textResponse.text.trim());
      const { questionText, answerText, imagePrompt } = textResult;

      if (!questionText || !imagePrompt) {
          throw new Error("AI failed to generate the question text or image prompt.");
      }
      
      // Add a delay between the text and image generation calls to avoid hitting API rate limits.
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Step 2: Generate the image using the prompt from the first step.
      const imageResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts: [{ text: imagePrompt }] },
          config: { responseModalities: [Modality.IMAGE] },
      });

      const imagePart = imageResponse.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

      if (!imagePart || !imagePart.inlineData) {
          throw new Error("AI failed to generate a valid image from the provided prompt.");
      }

      const imageDataURL = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
      
      // Step 3: Combine and return the results.
      return [{
          text: questionText,
          answer: shouldGenerateAnswer ? answerText : undefined,
          imageDataURL: imageDataURL
      }];
    }

    // Existing logic for text-only questions
    let formatInstructions = `Each question must be of the type: "${criteria.questionType || 'Short Answer'}".`;
    let jsonInstructions = 'The response must be a valid JSON array of objects.';

    const baseAnswerJson = `
Each object must have two required fields: "text" and "answer".`;

    switch (criteria.questionType) {
        case 'Multiple Choice':
        formatInstructions = 'Each question MUST be a multiple-choice question with exactly 4 distinct options, labeled A, B, C, and D.';
        jsonInstructions += `${baseAnswerJson}
- The "text" field MUST contain the question followed by the 4 options, formatted like: "Question text? A) Option 1 B) Option 2 C) Option 3 D) Option 4".
- The "answer" field MUST contain ONLY the capital letter of the correct option (e.g., "A", "B", "C", or "D").`;
        break;
        case 'Fill in the Blanks':
        formatInstructions = 'Each question MUST be a fill-in-the-blanks style question. Use one or more underscores `____` to represent the blank part.';
        jsonInstructions += `${baseAnswerJson}
- "text": The question text with blanks (e.g., "The powerhouse of the cell is the ____.").
- "answer": The word or phrase that correctly fills the blank. If there are multiple blanks, provide the answers in order, separated by a comma.`;
        break;
        case 'True/False':
        formatInstructions = 'Each question MUST be a statement that can be answered with "True" or "False".';
        jsonInstructions += `${baseAnswerJson}
- "text": The statement to be evaluated (e.g., "Mitochondria are found in plant cells.").
- "answer": The correct answer, which must be either "True" or "False".`;
        break;
        default: // Short Answer and others
        if (shouldGenerateAnswer) {
            jsonInstructions += `${baseAnswerJson}
- "text": The question text.
- "answer": A concise and correct answer to the question.`;
        } else {
            jsonInstructions += `
Each object must have one required field: "text". Do not include an "answer" field.`;
        }
        break;
    }

    const keywordInstructions = criteria.keywords
        ? `The questions must incorporate or be related to the following keywords: ${criteria.keywords}.`
        : '';

    const syllabusInstruction = criteria.wbbseSyllabusOnly
        ? `You are an expert in creating biology question papers for the West Bengal Board of Secondary Education (WBBSE) curriculum, specifically for Bengali Medium school students.
        Your task is to generate ${criteria.count} unique, high-quality questions based on the criteria below.
        **CRITICAL RULE: The content of all questions and answers MUST strictly adhere to the topics, scope, and depth of the official WBBSE Biology syllabus for the specified class. DO NOT include any content from other educational boards like CBSE, ICSE, etc.**`
        : `You are an expert in creating biology question papers. Your task is to generate ${criteria.count} unique, high-quality questions based on the criteria below.`;

    const prompt = `
        ${syllabusInstruction}
        
        **CRITICAL INSTRUCTION: All generated text, including questions and answers, MUST be in the ${targetLanguage} language.**

        Criteria:
        - Class: ${criteria.class}
        - Chapter: "${criteria.chapter || 'Various Topics'}"
        - Marks for each question: ${criteria.marks}
        - Difficulty: ${criteria.difficulty}

        Question Style Guidelines:
        - **Variety is key.** Create a mix of questions that test different cognitive skills: some should test basic recall (e.g., 'What is...?'), others should require explanation (e.g., 'Explain why...'), and some should ask for analysis or comparison (e.g., 'Differentiate between...'). Use diverse sentence structures and avoid starting every question the same way.
        - ${getStyleGuideline(criteria.questionType)}

        Specific Instructions for this Request:
        - ${formatInstructions}
        ${keywordInstructions ? `- ${keywordInstructions}` : ''}

        IMPORTANT: Do NOT repeat any of the following questions that have been used before:
        ${existingQuestionTexts.length > 0 ? existingQuestionTexts : "None"}

        Output Format:
        ${jsonInstructions.trim()}
    `;

    const responseSchema: any = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
            text: {
                type: Type.STRING,
                description: "The full text of the question. For MCQs, this includes the question and 4 options (A, B, C, D).",
            },
            answer: {
                type: Type.STRING,
                description: "A brief, optional answer. For MCQs, this MUST be the capital letter of the correct option (e.g., 'A'). For True/False, it MUST be 'True' or 'False'.",
            },
            },
            required: ["text"],
        },
        };

        if (shouldGenerateAnswer) {
            responseSchema.items.required.push("answer");
        }


    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: responseSchema,
        },
    });

    const jsonText = response.text.trim();
    const generated = JSON.parse(jsonText) as { text: string; answer?: string }[];
    
    if (!Array.isArray(generated)) {
        console.error("AI did not return a valid array:", generated);
        return [];
    }
    
    return generated;

  } catch (error) {
    console.error("Error generating questions with AI:", error);
    throw error;
  }
};