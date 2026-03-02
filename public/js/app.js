class VisionTutor {
  constructor() {
    this.ws = null;
    this.mediaStream = null;
    this.audioContext = null;
    this.audioWorklet = null;
    this.videoInterval = null;
    this.playbackContext = null;
    this.playbackQueue = [];
    this.isPlaying = false;
    this.isSessionActive = false;
    this.isCameraOn = false;
    this.isMicOn = false;
    this.currentTutorMessage = null;
    this.nextStartTime = 0;

    this.elements = {
      cameraPreview: document.getElementById('camera-preview'),
      videoOverlay: document.getElementById('video-overlay'),
      cameraBadge: document.getElementById('camera-badge'),
      btnCamera: document.getElementById('btn-camera'),
      btnMic: document.getElementById('btn-mic'),
      btnSession: document.getElementById('btn-session'),
      statusDot: document.querySelector('.status-dot'),
      statusText: document.getElementById('status-text'),
      audioVisualizer: document.getElementById('audio-visualizer'),
      transcriptArea: document.getElementById('transcript-area'),
      welcomeMessage: document.getElementById('welcome-message'),
      inputHint: document.getElementById('input-hint'),
    };

    this.bindEvents();
  }

  bindEvents() {
    this.elements.btnCamera.addEventListener('click', () => this.toggleCamera());
    this.elements.btnMic.addEventListener('click', () => this.toggleMic());
    this.elements.btnSession.addEventListener('click', () => this.toggleSession());
  }

  async toggleCamera() {
    if (this.isCameraOn) {
      this.stopCamera();
    } else {
      await this.startCamera();
    }
  }

  async startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false
      });
      this.mediaStream = this.mediaStream || stream;
      const videoTrack = stream.getVideoTracks()[0];
      if (this.mediaStream !== stream) {
        this.mediaStream.addTrack(videoTrack);
      }
      this.elements.cameraPreview.srcObject = stream;
      this.elements.videoOverlay.classList.add('hidden');
      this.elements.cameraBadge.classList.add('visible');
      this.elements.btnCamera.classList.add('active');
      this.isCameraOn = true;

      if (this.isSessionActive) {
        this.startVideoCapture();
      }
    } catch (err) {
      console.error('Camera access denied:', err);
      this.setStatus('Camera access denied', 'error');
    }
  }

  stopCamera() {
    if (this.mediaStream) {
      this.mediaStream.getVideoTracks().forEach(track => track.stop());
    }
    this.elements.cameraPreview.srcObject = null;
    this.elements.videoOverlay.classList.remove('hidden');
    this.elements.cameraBadge.classList.remove('visible');
    this.elements.btnCamera.classList.remove('active');
    this.isCameraOn = false;
    this.stopVideoCapture();
  }

  async toggleMic() {
    if (this.isMicOn) {
      this.stopMic();
    } else {
      await this.startMic();
    }
  }

  async startMic() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      this.audioContext = new AudioContext({ sampleRate: 16000 });
      await this.audioContext.audioWorklet.addModule('/js/audio-processor.js');

      const source = this.audioContext.createMediaStreamSource(stream);
      this.audioWorklet = new AudioWorkletNode(this.audioContext, 'pcm-processor');

      this.audioWorklet.port.onmessage = (event) => {
        if (this.isSessionActive && this.ws && this.ws.readyState === WebSocket.OPEN) {
          const pcmData = event.data;
          const base64 = this.arrayBufferToBase64(pcmData);
          this.ws.send(JSON.stringify({ type: 'audio', data: base64 }));
        }
      };

      source.connect(this.audioWorklet);
      this.audioWorklet.connect(this.audioContext.destination);

      this.micStream = stream;
      this.elements.btnMic.classList.add('active');
      this.isMicOn = true;
    } catch (err) {
      console.error('Microphone access denied:', err);
      this.setStatus('Microphone access denied', 'error');
    }
  }

  stopMic() {
    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }
    if (this.audioWorklet) {
      this.audioWorklet.disconnect();
      this.audioWorklet = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.elements.btnMic.classList.remove('active');
    this.isMicOn = false;
  }

  startVideoCapture() {
    if (this.videoInterval) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    this.videoInterval = setInterval(() => {
      if (!this.isCameraOn || !this.isSessionActive) return;
      const video = this.elements.cameraPreview;
      if (video.videoWidth === 0) return;

      canvas.width = 640;
      canvas.height = 480;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
      const base64 = dataUrl.split(',')[1];

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'video', data: base64 }));
      }
    }, 1000);
  }

  stopVideoCapture() {
    if (this.videoInterval) {
      clearInterval(this.videoInterval);
      this.videoInterval = null;
    }
  }

  async toggleSession() {
    if (this.isSessionActive) {
      this.endSession();
    } else {
      await this.startSession();
    }
  }

  async startSession() {
    if (!this.isMicOn) {
      await this.startMic();
    }
    if (!this.isMicOn) {
      this.setStatus('Microphone is required to start a session', 'error');
      return;
    }

    this.setStatus('Connecting...', 'default');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    this.ws.onopen = () => {
      this.ws.send(JSON.stringify({ type: 'start_session' }));
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleServerMessage(message);
    };

    this.ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      this.setStatus('Connection error', 'error');
    };

    this.ws.onclose = () => {
      if (this.isSessionActive) {
        this.setStatus('Connection lost', 'error');
        this.isSessionActive = false;
        this.updateSessionUI();
      }
    };
  }

  endSession() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'end_session' }));
    }
    this.isSessionActive = false;
    this.stopVideoCapture();
    this.updateSessionUI();
    this.setStatus('Session ended', 'default');
    this.elements.audioVisualizer.classList.remove('active');
    this.stopPlayback();
  }

  handleServerMessage(message) {
    switch (message.type) {
      case 'session_started':
        this.isSessionActive = true;
        this.updateSessionUI();
        this.setStatus('Connected - listening', 'connected');
        if (this.elements.welcomeMessage) {
          this.elements.welcomeMessage.style.display = 'none';
        }
        if (this.isCameraOn) {
          this.startVideoCapture();
        }
        this.addSystemMessage('Session started. Speak naturally or show your work to the camera.');
        break;

      case 'audio':
        this.playAudio(message.data);
        this.setStatus('Tutor is speaking', 'speaking');
        this.elements.audioVisualizer.classList.add('active');
        this.animateVisualizer();
        break;

      case 'text':
        this.appendTutorText(message.data);
        break;

      case 'interrupted':
        this.stopPlayback();
        this.setStatus('Listening...', 'connected');
        this.elements.audioVisualizer.classList.remove('active');
        if (this.currentTutorMessage) {
          const textEl = this.currentTutorMessage.querySelector('.message-text');
          if (textEl) textEl.classList.remove('streaming');
          this.currentTutorMessage = null;
        }
        break;

      case 'turn_complete':
        this.setStatus('Listening...', 'connected');
        this.elements.audioVisualizer.classList.remove('active');
        if (this.currentTutorMessage) {
          const textEl = this.currentTutorMessage.querySelector('.message-text');
          if (textEl) textEl.classList.remove('streaming');
          this.currentTutorMessage = null;
        }
        break;

      case 'error':
        console.error('Server error:', message.data);
        this.setStatus('Error: ' + message.data, 'error');
        this.addSystemMessage('Error: ' + message.data);
        break;

      case 'session_closed':
        this.isSessionActive = false;
        this.updateSessionUI();
        this.setStatus('Session closed', 'default');
        if (this.ws) {
          this.ws.close();
          this.ws = null;
        }
        break;
    }
  }

  playAudio(base64Data) {
    if (!this.playbackContext) {
      this.playbackContext = new AudioContext({ sampleRate: 24000 });
      this.nextStartTime = this.playbackContext.currentTime;
    }

    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768.0;
    }

    const buffer = this.playbackContext.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);

    const source = this.playbackContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.playbackContext.destination);

    const now = this.playbackContext.currentTime;
    const startTime = Math.max(now, this.nextStartTime);
    source.start(startTime);
    this.nextStartTime = startTime + buffer.duration;
  }

  stopPlayback() {
    if (this.playbackContext) {
      this.playbackContext.close();
      this.playbackContext = null;
    }
    this.nextStartTime = 0;
  }

  animateVisualizer() {
    if (!this.elements.audioVisualizer.classList.contains('active')) return;
    const bars = this.elements.audioVisualizer.querySelectorAll('.viz-bar');
    bars.forEach(bar => {
      const height = Math.random() * 20 + 4;
      bar.style.height = `${height}px`;
    });
    requestAnimationFrame(() => {
      setTimeout(() => this.animateVisualizer(), 100);
    });
  }

  appendTutorText(text) {
    if (!this.currentTutorMessage) {
      this.currentTutorMessage = this.createMessage('tutor', '');
    }
    const textEl = this.currentTutorMessage.querySelector('.message-text');
    textEl.textContent += text;
    textEl.classList.add('streaming');
    this.scrollToBottom();
  }

  createMessage(role, text) {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${role}`;

    const avatar = role === 'tutor' ? 'VT' : 'You';
    const label = role === 'tutor' ? 'VisionTutor' : 'You';

    messageEl.innerHTML = `
      <div class="message-avatar">${avatar}</div>
      <div class="message-content">
        <div class="message-label">${label}</div>
        <div class="message-text">${text}</div>
      </div>
    `;

    this.elements.transcriptArea.appendChild(messageEl);
    this.scrollToBottom();
    return messageEl;
  }

  addSystemMessage(text) {
    const msgEl = document.createElement('div');
    msgEl.className = 'message system';
    msgEl.innerHTML = `
      <div style="width: 100%; text-align: center; padding: 8px; color: var(--text-muted); font-size: 0.8rem; font-style: italic;">
        ${text}
      </div>
    `;
    this.elements.transcriptArea.appendChild(msgEl);
    this.scrollToBottom();
  }

  scrollToBottom() {
    this.elements.transcriptArea.scrollTop = this.elements.transcriptArea.scrollHeight;
  }

  setStatus(text, state) {
    this.elements.statusText.textContent = text;
    const dot = this.elements.statusDot;
    dot.className = 'status-dot';
    if (state === 'connected') dot.classList.add('connected');
    else if (state === 'speaking') dot.classList.add('speaking');
    else if (state === 'error') dot.classList.add('error');
  }

  updateSessionUI() {
    const iconStart = this.elements.btnSession.querySelector('.icon-start');
    const iconStop = this.elements.btnSession.querySelector('.icon-stop');

    if (this.isSessionActive) {
      iconStart.style.display = 'none';
      iconStop.style.display = 'block';
      this.elements.btnSession.classList.add('active');
      this.elements.btnSession.title = 'End Session';
    } else {
      iconStart.style.display = 'block';
      iconStop.style.display = 'none';
      this.elements.btnSession.classList.remove('active');
      this.elements.btnSession.title = 'Start Session';
    }
  }

  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new VisionTutor();
});
