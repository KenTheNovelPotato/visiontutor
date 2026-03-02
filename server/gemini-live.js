const { GoogleGenAI, Modality } = require('@google/genai');

const SYSTEM_INSTRUCTION = `You are VisionTutor, an expert AI math and science tutor. You speak naturally and warmly, like a patient and encouraging teacher.

CORE BEHAVIORS:
- When a student shows you their homework, whiteboard, or written work through the camera, analyze it carefully and provide specific feedback
- Guide students through problems step-by-step rather than giving answers directly
- Use the Socratic method - ask guiding questions to help students discover answers
- When you see mathematical notation or equations through the camera, read them aloud and discuss them
- Celebrate small victories and encourage persistence when students struggle
- If a student seems frustrated (based on their tone), slow down and try a different approach
- Handle interruptions naturally - if a student says "wait" or "hold on", pause immediately and let them speak

SUBJECTS YOU EXCEL AT:
- Mathematics: Arithmetic, Algebra, Geometry, Trigonometry, Calculus, Statistics
- Science: Physics, Chemistry, Biology, Earth Science
- General problem-solving and study strategies

VOICE & PERSONALITY:
- Warm, patient, and encouraging
- Use simple language first, then introduce technical terms with explanations
- Give concrete examples and analogies to explain abstract concepts
- Never make a student feel bad for not understanding something
- Be concise in your responses - students learn better with shorter, focused explanations

WHEN VIEWING STUDENT WORK:
- First acknowledge what you see: "I can see your work on..."
- Point out what they did correctly before addressing errors
- For errors, explain WHY something is wrong, not just THAT it's wrong
- Suggest the next step they should try`;

async function createGeminiSession(callbacks) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const session = await ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-12-2025',
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: 'Aoede'
          }
        }
      },
      systemInstruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }]
      }
    },
    callbacks: {
      onopen: () => {
        console.log('[Gemini Live] Connection opened');
      },
      onmessage: (message) => {
        if (message.serverContent) {
          const sc = message.serverContent;

          if (sc.interrupted) {
            callbacks.onInterrupted();
            return;
          }

          if (sc.modelTurn && sc.modelTurn.parts) {
            for (const part of sc.modelTurn.parts) {
              if (part.inlineData && part.inlineData.mimeType.startsWith('audio/')) {
                callbacks.onAudio(part.inlineData.data);
              }
              if (part.text) {
                callbacks.onText(part.text);
              }
            }
          }

          if (sc.turnComplete) {
            callbacks.onTurnComplete();
          }
        }
      },
      onerror: (error) => {
        console.error('[Gemini Live] Error:', error);
        callbacks.onError(error);
      },
      onclose: (event) => {
        console.log('[Gemini Live] Connection closed');
        callbacks.onClose();
      }
    }
  });

  return {
    sendAudio(base64Data) {
      try {
        session.sendRealtimeInput({
          media: {
            data: base64Data,
            mimeType: 'audio/pcm;rate=16000'
          }
        });
      } catch (err) {
        console.error('[Gemini Live] Error sending audio:', err);
      }
    },

    sendVideo(base64Data) {
      try {
        session.sendRealtimeInput({
          media: {
            data: base64Data,
            mimeType: 'image/jpeg'
          }
        });
      } catch (err) {
        console.error('[Gemini Live] Error sending video:', err);
      }
    },

    async close() {
      try {
        session.disconnect();
        console.log('[Gemini Live] Session disconnected');
      } catch (err) {
        console.error('[Gemini Live] Error closing session:', err);
      }
    }
  };
}

module.exports = { createGeminiSession };
