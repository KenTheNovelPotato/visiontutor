import { GoogleGenAI, Modality } from '@google/genai';
import { SYSTEM_INSTRUCTION, getToolDeclarations, executeToolCall } from './agent.js';

export async function createGeminiSession(callbacks) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const toolDeclarations = getToolDeclarations();

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
      },
      tools: toolDeclarations,
    },
    callbacks: {
      onopen: () => {
        console.log('[Gemini Live] Connection opened');
      },
      onmessage: (message) => {
        if (message.toolCall) {
          handleToolCall(session, message.toolCall, callbacks);
          return;
        }

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

async function handleToolCall(session, toolCall, callbacks) {
  if (!toolCall.functionCalls || toolCall.functionCalls.length === 0) return;

  const responses = [];

  for (const fc of toolCall.functionCalls) {
    console.log(`[Gemini Live] Tool call: ${fc.name}`, JSON.stringify(fc.args));
    callbacks.onText(`[Using tool: ${fc.name}]\n`);

    const result = executeToolCall(fc.name, fc.args);
    console.log(`[Gemini Live] Tool result:`, JSON.stringify(result));

    responses.push({
      id: fc.id,
      name: fc.name,
      response: result,
    });
  }

  try {
    session.sendToolResponse({ functionResponses: responses });
    console.log('[Gemini Live] Tool response sent');
  } catch (err) {
    console.error('[Gemini Live] Error sending tool response:', err);
  }
}
