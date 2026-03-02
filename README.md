# VisionTutor - AI Math & Science Tutor with Real-Time Vision

A real-time AI tutoring agent powered by the **Gemini 2.5 Flash Live API** that helps students with math and science through natural voice conversation and live camera vision. Built for the [Gemini Live Agent Challenge](https://geminiliveagentchallenge.devpost.com/).

## What It Does

VisionTutor breaks the "text box" paradigm by creating an immersive, real-time tutoring experience:

- **Voice Interaction** — Talk naturally to the tutor. It listens in real-time and responds with natural speech. You can interrupt it anytime, just like a real conversation.
- **Live Vision** — Turn on your camera and show your homework, whiteboard, or written work. The AI sees it in real-time (~1 FPS) and gives specific, contextual feedback on what you've written.
- **Socratic Method** — Rather than giving answers directly, VisionTutor guides students through problems step-by-step with encouraging, patient explanations.
- **Natural Interruptions** — Say "wait" or "hold on" and the tutor pauses immediately, just like a human teacher would.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Browser Client                    │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │  Camera   │  │   Mic    │  │  Audio Playback  │  │
│  │ (Canvas)  │  │(Worklet) │  │   (WebAudio)     │  │
│  └─────┬─────┘  └────┬─────┘  └────────▲─────────┘  │
│        │              │                 │            │
│        └──────┬───────┘                 │            │
│               │ WebSocket               │            │
└───────────────┼─────────────────────────┼────────────┘
                │                         │
                ▼                         │
┌───────────────────────────────────────────────────────┐
│              Node.js Backend (Express)                │
│                   Port 5000                           │
│                                                       │
│  ┌─────────────────────────────────────────────────┐  │
│  │           WebSocket Server (ws)                 │  │
│  │                                                 │  │
│  │  ┌───────────────────────────────────────────┐  │  │
│  │  │      Gemini Live API Session Manager      │  │  │
│  │  │                                           │  │  │
│  │  │  • Sends audio (PCM 16kHz) ──────────►   │  │  │
│  │  │  • Sends video (JPEG frames) ────────►   │  │  │
│  │  │  ◄──────── Receives audio (PCM 24kHz)    │  │  │
│  │  │  ◄──────── Receives text transcript      │  │  │
│  │  └───────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────┘  │
└───────────────────────────┬───────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────┐
│               Google Cloud / Gemini API               │
│                                                       │
│  ┌─────────────────────────────────────────────────┐  │
│  │  Gemini 2.5 Flash Native Audio (Live API)       │  │
│  │  Model: gemini-2.5-flash-native-audio-preview   │  │
│  │                                                 │  │
│  │  • Real-time bidirectional audio streaming      │  │
│  │  • Vision understanding (JPEG frames)           │  │
│  │  • Voice Activity Detection (VAD)               │  │
│  │  • Natural interruption handling                │  │
│  └─────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────┘
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| **AI Model** | Gemini 2.5 Flash Native Audio (Live API) |
| **SDK** | Google GenAI SDK (`@google/genai`) |
| **Backend** | Node.js, Express, WebSocket (`ws`) |
| **Frontend** | Vanilla HTML/CSS/JS |
| **Audio Capture** | AudioWorklet API (PCM 16-bit, 16kHz mono) |
| **Audio Playback** | Web Audio API (PCM 16-bit, 24kHz mono) |
| **Video Capture** | Canvas API (JPEG at ~1 FPS) |
| **Google Cloud** | Gemini API (Vertex AI compatible) |

## Spin-Up Instructions

### Prerequisites

- Node.js 18+ installed
- A Google Gemini API key ([get one here](https://aistudio.google.com/apikey))

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/visiontutor.git
   cd visiontutor
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set your Gemini API key**
   ```bash
   export GEMINI_API_KEY="your-api-key-here"
   ```

4. **Start the server**
   ```bash
   npm start
   ```

5. **Open in your browser**
   Navigate to `http://localhost:5000`

### Usage

1. Click the **camera button** to enable your webcam
2. Click the **microphone button** to enable audio
3. Click the **play button** to start a tutoring session
4. Start talking or show your homework to the camera

## Project Structure

```
├── server/
│   ├── index.js              # Express + WebSocket server
│   └── gemini-live.js        # Gemini Live API session manager
├── public/
│   ├── index.html            # Main UI
│   ├── css/
│   │   └── style.css         # Styling
│   └── js/
│       ├── app.js            # Frontend app logic
│       └── audio-processor.js # AudioWorklet for mic capture
├── package.json
└── README.md
```

## How It Works

1. **Audio Capture**: The browser captures microphone audio at 16kHz using an AudioWorklet processor that outputs raw PCM 16-bit samples.

2. **Video Capture**: When the camera is enabled, the browser captures video frames at ~1 FPS, encoding them as JPEG via the Canvas API.

3. **WebSocket Proxy**: Audio and video data are sent over a WebSocket connection to the Node.js backend, which proxies them to the Gemini Live API.

4. **Gemini Processing**: The Gemini 2.5 Flash model processes the audio and video streams in real-time, understanding both what the student says and what they show on camera.

5. **Audio Response**: Gemini responds with streaming audio at 24kHz, which is sent back through the WebSocket and played in the browser using the Web Audio API.

6. **Interruption Handling**: The Live API's built-in Voice Activity Detection (VAD) allows the student to interrupt the tutor naturally at any point.

## Google Cloud Services Used

- **Gemini API** — Core AI model for real-time multimodal understanding and audio generation via the Live API

## Key Features for Judges

- **Breaks the text box paradigm**: Pure voice + vision interaction, no typing required
- **Real-time and context-aware**: Sub-second latency with continuous audio/video streams
- **Distinct persona**: VisionTutor has a warm, patient teaching personality that adapts to student needs
- **Natural interruptions**: Students can interrupt mid-explanation, just like with a real teacher
- **Vision-enabled**: Can see and analyze handwritten work, equations, diagrams in real-time
- **Socratic method**: Guides discovery rather than giving direct answers

## License

MIT
