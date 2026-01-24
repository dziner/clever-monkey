import { GoogleGenAI, Chat, Part, Type } from '@google/genai';
import { getSystemInstruction, initialBotMessage } from '../constants';
import { Model, ProcessingModel, DocumentProcessingState, QuizData, FRQData, UserAnswer, FRUserAnswer } from '../types';

export const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Utility to safely parse JSON from LLM output which might contain Markdown code blocks or extra text
const cleanAndParseJSON = (text: string) => {
    // 1. Try to find JSON structure within the text (most robust)
    const firstOpenBrace = text.indexOf('{');
    const firstOpenBracket = text.indexOf('[');
    let startIndex = -1;
    
    if (firstOpenBrace !== -1 && firstOpenBracket !== -1) {
        startIndex = Math.min(firstOpenBrace, firstOpenBracket);
    } else if (firstOpenBrace !== -1) {
        startIndex = firstOpenBrace;
    } else if (firstOpenBracket !== -1) {
        startIndex = firstOpenBracket;
    }
    
    if (startIndex !== -1) {
        const lastCloseBrace = text.lastIndexOf('}');
        const lastCloseBracket = text.lastIndexOf(']');
        let endIndex = -1;
        
        if (lastCloseBrace !== -1 && lastCloseBracket !== -1) {
            endIndex = Math.max(lastCloseBrace, lastCloseBracket);
        } else if (lastCloseBrace !== -1) {
            endIndex = lastCloseBrace;
        } else if (lastCloseBracket !== -1) {
            endIndex = lastCloseBracket;
        }
        
        if (endIndex !== -1 && endIndex >= startIndex) {
             const candidate = text.substring(startIndex, endIndex + 1);
             try {
                 return JSON.parse(candidate);
             } catch (e) {
                 // If extraction fails, fail through to simple regex replacement
             }
        }
    }

    // 2. Fallback to removing markdown code blocks
    const cleaned = text.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/```$/, '').trim();
    return JSON.parse(cleaned);
};

async function fileToGenerativePart(file: File): Promise<Part> {
    const base64EncodedData = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
    });
    return {
        inlineData: {
            data: base64EncodedData,
            mimeType: file.type,
        },
    };
}

// This new function replaces extractTextFromPdf and extractTextFromImage.
// It uses a multimodal model to perform OCR on any document (PDF or image).
async function extractTextFromDocument(file: File, model: ProcessingModel): Promise<string> {
    // For plain text and markdown, just read the text directly for efficiency and accuracy.
    if (file.type === 'text/plain' || file.type === 'text/markdown') {
        return await file.text();
    }
    
    // For PDFs and images, use the multimodal model to extract text content.
    const documentPart = await fileToGenerativePart(file);
    const textPart = { text: "Extract all text from this document. Respond with only the text content. If there is no text, return an empty string." };
    
    const response = await ai.models.generateContent({
        model: model,
        contents: { parts: [documentPart, textPart] },
    });
    
    return response.text;
}

export async function processDocument(
    file: File,
    model: ProcessingModel,
    onProgress: (state: DocumentProcessingState) => void
): Promise<{ summary: string; presetQuestions: string[]; chat: Chat; documentContent: string; tokenCount: number; }> {
    // The initial step is to extract text content from the document. This is robust and works
    // for standard PDFs, scanned (image-based) PDFs/images, and now plain text files.
    onProgress('reading');
    const documentContent = await extractTextFromDocument(file, model);

    // If no text could be extracted, we cannot proceed.
    if (!documentContent.trim()) {
        throw new Error("Could not extract any text from the document. It might be empty, contain only images, or be unreadable.");
    }

    const { totalTokens } = await ai.models.countTokens({ model: model, contents: { parts: [{ text: documentContent }] } });
    const tokenCount = totalTokens;

    onProgress('summarizing');
    const summaryPrompt = `Based on the following document, provide a comprehensive, well-structured summary. Use Markdown for formatting (headings, lists, bold text) to make it clear and easy to read.\n\nDOCUMENT CONTENT:\n"""\n${documentContent}\n"""`;
    const summaryResponse = await ai.models.generateContent({ model: model, contents: summaryPrompt });
    const summary = summaryResponse.text;
    
    onProgress('generating_questions');
    const questionsPrompt = `Based on the following document, generate 3-4 insightful and distinct preset questions a user might ask to better understand the content. Prefix each question with a relevant emoji. Format the response as a JSON array of strings.\n\nDOCUMENT CONTENT:\n"""\n${documentContent}\n"""\n\nExample output: ["❓ What is the main topic?", "📄 Can you summarize section 2?", "🔑 What are the key terms?"]`;
    const questionsResponse = await ai.models.generateContent({ 
        model: model, 
        contents: questionsPrompt, 
        config: { 
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.STRING
                }
            }
        } 
    });

    let presetQuestions: string[];
    try {
        const parsedQuestions = cleanAndParseJSON(questionsResponse.text);
        presetQuestions = Array.isArray(parsedQuestions) && parsedQuestions.length > 0 ? parsedQuestions : [
             "❓ What is the main takeaway from this document?",
             "📄 Can you summarize the key points?",
             "🔑 What are the key terms mentioned?",
        ];
    } catch (e) {
        console.error("Failed to parse preset questions:", e, questionsResponse.text);
        presetQuestions = [
            "❓ What is the main takeaway from this document?",
            "📄 Can you summarize the key points?",
            "🔑 What are the key terms mentioned?",
        ];
    }

    const chat = ai.chats.create({
        model: model,
        config: {
            systemInstruction: getSystemInstruction('document', false),
        },
        history: [
            { role: "user", parts: [{ text: `Here is the document I've uploaded. All of your answers must be based on this content. DOCUMENT CONTENT:\n"""${documentContent}"""` }] },
            { role: "model", parts: [{ text: initialBotMessage.text }] }
        ],
    });

    return { summary, presetQuestions, chat, documentContent, tokenCount };
}

export async function generateQuiz(
    documentContent: string,
    model: Model,
    quizType: 'mcq' | 'frq',
    questionCount: number
): Promise<QuizData | FRQData> {
    let prompt: string;
    let responseSchema: any;

    if (quizType === 'mcq') {
        prompt = `Based on the DOCUMENT CONTENT provided, generate a ${questionCount}-question multiple-choice quiz. The quiz title must be engaging and MUST include a relevant emoji.`;
        responseSchema = {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING, description: "An engaging title for the quiz, including a relevant emoji." },
                questions: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            questionText: { type: Type.STRING },
                            options: { type: Type.ARRAY, items: { type: Type.STRING } },
                            correctAnswerIndex: { type: Type.INTEGER },
                            explanation: { type: Type.STRING }
                        },
                        required: ['questionText', 'options', 'correctAnswerIndex', 'explanation']
                    }
                }
            },
            required: ['title', 'questions']
        };
    } else { // frq
        prompt = `Based on the DOCUMENT CONTENT provided, generate a ${questionCount}-question free-response quiz. The quiz title must be engaging and MUST include a relevant emoji.`;
        responseSchema = {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING, description: "An engaging title for the quiz, including a relevant emoji." },
                questions: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            questionText: { type: Type.STRING, description: 'The free-response question.' },
                            explanation: { type: Type.STRING, description: 'A concise, ideal answer to the question for grading reference.' }
                        },
                        required: ['questionText', 'explanation']
                    }
                }
            },
            required: ['title', 'questions']
        };
    }

    const fullPrompt = `${prompt}\n\nDOCUMENT CONTENT:\n"""\n${documentContent}\n"""`;

    const response = await ai.models.generateContent({
        model,
        contents: fullPrompt,
        config: {
            responseMimeType: "application/json",
            responseSchema
        }
    });

    return cleanAndParseJSON(response.text) as QuizData | FRQData;
}

export async function evaluateFRQAnswer(
    question: string,
    referenceAnswer: string,
    userAnswer: string,
    model: Model
): Promise<{ score: number; feedback: string }> {
    const prompt = `
        A user was asked a question based on a document. Please evaluate their answer.

        Question: "${question}"
        Ideal Answer (for reference): "${referenceAnswer}"
        User's Answer: "${userAnswer}"

        Based on the user's answer, provide a score from 0 to 100 on how well they answered, and brief, constructive feedback.
        Respond ONLY with a JSON object containing two keys: "score" (a number from 0 to 100) and "feedback" (a string).
    `;

    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    score: { type: Type.INTEGER, description: "A score from 0 to 100 for the user's answer." },
                    feedback: { type: Type.STRING, description: "Constructive feedback for the user's answer." }
                },
                required: ['score', 'feedback']
            }
        }
    });

    return cleanAndParseJSON(response.text);
}


export async function generateStudyTips(
    documentContent: string,
    quizContent: QuizData | FRQData,
    userAnswers: (UserAnswer | FRUserAnswer)[],
    model: Model
): Promise<string> {
    const isMCQ = 'options' in quizContent.questions[0];

    let incorrectResultsSummary = '';
    if (isMCQ) {
        const mcqAnswers = userAnswers as UserAnswer[];
        incorrectResultsSummary = (quizContent as QuizData).questions.map((q, i) => {
            const answer = mcqAnswers.find(a => a.questionIndex === i);
            if (!answer || answer.isCorrect) return null; // Filter out correct answers
            return `
- Question: "${q.questionText}"
  - Your Incorrect Answer: "${q.options[answer.selectedOptionIndex]}"
  - Correct Answer: "${q.options[q.correctAnswerIndex]}"
  - Explanation for Correct Answer: ${q.explanation}
            `.trim();
        }).filter(Boolean).join('\n');
    } else {
        const frqAnswers = userAnswers as FRUserAnswer[];
        incorrectResultsSummary = (quizContent as FRQData).questions.map((q, i) => {
            const answer = frqAnswers.find(a => a.questionIndex === i);
            const LOW_SCORE_THRESHOLD = 70;
            if (!answer || (answer.score !== undefined && answer.score >= LOW_SCORE_THRESHOLD)) return null;
            return `
- Question: "${q.questionText}"
  - Your Answer: "${answer.userAnswerText}"
  - Score: ${answer.score}/100
  - AI Feedback: ${answer.feedback}
  - Ideal Answer for Reference: ${q.explanation}
            `.trim();
        }).filter(Boolean).join('\n');
    }

    const allCorrect = userAnswers.every(a => (a as UserAnswer).isCorrect === true || (a as FRUserAnswer).score >= 70);
    if (allCorrect) {
        return "### 🎯 All Correct!\n\nExcellent work! You've demonstrated a strong understanding of the material. No review needed for this quiz.";
    }

    const prompt = `
You are a precise AI Tutor. Your task is to analyze a user's quiz results and provide a concise "Key Concepts for Review" list based ONLY on their incorrect or low-scoring answers.

**DOCUMENT CONTENT:**
"""
${documentContent}
"""

**QUIZ RESULTS (Incorrect/Low-Scoring Answers Only):**
"""
${incorrectResultsSummary}
"""

**YOUR TASK:**

1.  **Analyze Mistakes:** Based *only* on the incorrect/low-scoring answers provided, identify the specific concepts, terms, or topics the user is struggling with.
2.  **Provide Corrections:** Create a clear, concise, and factual list of these concepts. For each concept:
    *   Start with the concept/term in bold (e.g., \`**Photosynthesis:**\`).
    *   Provide a brief, correct explanation of the concept, drawing directly from the provided **DOCUMENT CONTENT**. This should clarify the user's misunderstanding.
3.  **Identify Weak Areas:** If you notice a pattern of mistakes (e.g., struggling with dates, specific processes, a particular chapter), add a "💡 **Focus Areas**" section at the end. In this section, suggest specific topics or sections from the document to review.
4.  **Formatting:**
    *   Use Markdown.
    *   The main title **MUST** be \`### 🎯 Key Concepts for Review\`.
    *   Use bullet points for each concept.

**IMPORTANT RULES:**
- **BE CONCISE AND DIRECT.** Get straight to the point.
- **DO NOT** include any motivational phrases, encouragement, or comments on study habits/attitude (e.g., avoid "Good job!", "Don't worry!", "Try studying this way...").
- **FOCUS ONLY ON CONTENT.** Your entire output should be about clarifying misunderstood concepts from the document.
    `;
    
    const response = await ai.models.generateContent({ model, contents: prompt });
    return response.text;
}