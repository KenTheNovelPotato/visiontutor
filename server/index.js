import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { createGeminiSession } from './gemini-live.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

wss.on('connection', (ws) => {
  console.log('[WSS] Browser client connected');
  let geminiSession = null;

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'start_session':
          if (geminiSession) {
            await geminiSession.close();
          }
          geminiSession = await createGeminiSession({
            onAudio: (audioData) => {
              if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ type: 'audio', data: audioData }));
              }
            },
            onText: (text) => {
              if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ type: 'text', data: text }));
              }
            },
            onInterrupted: () => {
              if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ type: 'interrupted' }));
              }
            },
            onTurnComplete: () => {
              if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ type: 'turn_complete' }));
              }
            },
            onError: (error) => {
              console.error('[Gemini] Error:', error);
              if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ type: 'error', data: error.message || String(error) }));
              }
            },
            onClose: () => {
              console.log('[Gemini] Session closed');
              if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ type: 'session_closed' }));
              }
            }
          });
          ws.send(JSON.stringify({ type: 'session_started' }));
          console.log('[WSS] Gemini session started');
          break;

        case 'audio':
          if (geminiSession) {
            geminiSession.sendAudio(message.data);
          }
          break;

        case 'video':
          if (geminiSession) {
            geminiSession.sendVideo(message.data);
          }
          break;

        case 'end_session':
          if (geminiSession) {
            await geminiSession.close();
            geminiSession = null;
          }
          ws.send(JSON.stringify({ type: 'session_closed' }));
          break;

        default:
          console.warn('[WSS] Unknown message type:', message.type);
      }
    } catch (err) {
      console.error('[WSS] Error processing message:', err);
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'error', data: err.message }));
      }
    }
  });

  ws.on('close', async () => {
    console.log('[WSS] Browser client disconnected');
    if (geminiSession) {
      await geminiSession.close();
      geminiSession = null;
    }
  });

  ws.on('error', (err) => {
    console.error('[WSS] WebSocket error:', err);
  });
});

const PORT = 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] VisionTutor running on http://0.0.0.0:${PORT}`);
});
