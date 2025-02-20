async function loadProtobuf() {
    const protobufModule = await import('https://cdn.jsdelivr.net/npm/protobufjs@7.2.4/dist/protobuf.min.js');
    return true;
}

class HandleUI {
    constructor() {
        this.websocketClient = null;
        this.statusText = null;
        this.statusIndicator = null;
        this.innerDiv = null;
        this.voiceAgentContainer = document.getElementById('voice_agent_container');
        
        this.initVoiceAgentContainer();
    }

    initVoiceAgentContainer() {
        // Create main circle container
        const innerDiv = document.createElement('div');
        innerDiv.classList.add('voice-agent-circle');

        // Create voice wave icon
        const voiceWave = document.createElement('div');
        voiceWave.classList.add('voice-wave');
        
        // Add 5 bars for the wave animation
        for (let i = 0; i < 5; i++) {
            const bar = document.createElement('span');
            voiceWave.appendChild(bar);
        }
        
        innerDiv.appendChild(voiceWave);

        // Create status container and elements
        const statusContainer = document.createElement('div');
        statusContainer.classList.add('status-container');

        const statusText = document.createElement('div');
        statusText.classList.add('status-text');
        statusText.textContent = 'Click to start...';

        const statusIndicator = document.createElement('div');
        statusIndicator.classList.add('status-indicator');
        
        // Add 3 loading dots
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('div');
            dot.classList.add('status-dot');
            statusIndicator.appendChild(dot);
        }

        const stopButton = document.createElement('button');
        stopButton.classList.add('stop-button');
        stopButton.textContent = 'Stop';

        // Store references
        this.statusText = statusText;
        this.statusIndicator = statusIndicator;
        this.innerDiv = innerDiv;

        // Assemble components
        statusContainer.appendChild(statusText);
        statusContainer.appendChild(statusIndicator);
        statusContainer.appendChild(stopButton);
        innerDiv.appendChild(statusContainer);
        this.voiceAgentContainer.appendChild(innerDiv);

        // Add event listeners
        innerDiv.addEventListener('click', () => {
            if (!innerDiv.classList.contains('expanded')) {
                this.updateStatus('connecting', 'Connecting...');
                this.websocketClient = new WebSocketClient();
                this.websocketClient.connect(this);
            }
        });

        stopButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.updateStatus('failed', 'Stopping...');
            if (this.websocketClient) {
                this.websocketClient.disconnect();
                this.websocketClient = null;
            }
        });
    }

    updateStatus(status, message) {
        try {
            if (!this.innerDiv || !this.statusText || !this.statusIndicator) {
                return;
            }

            // Remove all previous status classes
            this.innerDiv.classList.remove('expanded', 'connecting', 'connected', 'failed');
            
            // Update status based on the status parameter
            switch (status) {
                case 'connecting':
                    this.innerDiv.classList.add('expanded', 'connecting');
                    Array.from(this.statusIndicator.children).forEach(dot => {
                        dot.classList.add('loading');
                    });
                    break;
                case 'connected':
                    this.innerDiv.classList.add('expanded', 'connected');
                    Array.from(this.statusIndicator.children).forEach(dot => {
                        dot.classList.remove('loading');
                    });
                    break;
                case 'failed':
                    this.innerDiv.classList.add('failed');
                    Array.from(this.statusIndicator.children).forEach(dot => {
                        dot.classList.remove('loading');
                    });
                    break;
                default:
                    Array.from(this.statusIndicator.children).forEach(dot => {
                        dot.classList.remove('loading');
                    });
            }
            
            if (message) {
                this.statusText.textContent = message;
            }
        } catch (error) {
            console.error(`Error updating status: ${error.message}`);
        }
    }
}

class WebSocketClient {
    constructor(url=null) {
        this.BASE_URL = url ? url : 'ws://localhost:8000';
        this.uid = null;
        this.SAMPLE_RATE = 24000;
        this.NUM_CHANNELS = 1;
        
        this.isPlaying = true;
        this.playTime = 0;
        this.Frame = null;
        this.audioContext = null;
        this.ws = null;
        
        this.microphoneStream = null;
        this.scriptProcessor = null;
        this.source = null;
        
        this.initProtobuf();
        this.initAudioSystem();
        this.setupEventListeners();
    }

    async initProtobuf() {
        try{
            await loadProtobuf();
            protobuf.load('https://sainirahulsnakescript.github.io/audio_socket/frame.proto', (err, root) => {
                if (err) {
                    console.error("Error loading protobuf schema", err);
                    throw err;
                }
                this.Frame = root.lookupType('Frame');
            });
        } catch (error) {
            this.log(`Error loading protobuf schema: ${error.message}`, 'error');
        }
    }

    initAudioSystem() {
        try{
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                latencyHint: 'interactive',
                sampleRate: this.SAMPLE_RATE
            });
        } catch (error) {
            this.log(`Error initializing audio system: ${error.message}`, 'error');
        }
    }
    
    setupEventListeners() {
        try{

            // Modified user interaction handler
            document.addEventListener('click', async () => {
                if (!this.audioContext) {
                    // Create AudioContext on first click
                    this.audioContext = new AudioContext();
                    this.log('Audio context created after user interaction', 'info');
                } else if (this.audioContext.state === 'suspended') {
                    await this.audioContext.resume();
                    this.log('Audio resumed after user interaction', 'info');
                }
            }, { once: true }); // Only handle first click
            this.Frame = null;
        } catch (error) {
            this.log(`Error setting up event listeners: ${error.message}`, 'error');
        }
    }
    
    log(message, type = 'info') {
        if (type === 'info') {
            console.log(message);
        }
        else if (type === 'error') {
            console.log(message);
        }
        else if (type === 'warning') {
            console.log(message);
        }
        else if (type === 'debug') {
            console.log(message);
        }
        else {
            console.log(message);
        }
    }
    
    getAuthHeader() {
        try{
            const username = 'admin';
            const password = 'admin123';
            return 'Basic ' + btoa(`${username}:${password}`);
        } catch (error) {
            this.log(`Error getting auth header: ${error.message}`, 'error');
        }
    }
    
    async initAudioContext() {
        try {
            window.AudioContext = window.AudioContext || window.webkitAudioContext;
            this.log('Audio system initialized', 'info');
            
            // Initialize audio processing when context is created
            if (this.audioContext) {
                await this.setupAudioProcessing();
            }
        } catch (error) {
            this.log(`Audio initialization failed: ${error.message}`, 'error');
        }
    }
    
    
    async connect(uiHandler) {
        try {
            uiHandler.updateStatus('connecting', 'Connecting...');
            this.log('Attempting to connect...');
            
            // Use dynamic WebSocket URL
            const authHeader = this.getAuthHeader();
            const wsUrl = `${this.BASE_URL}/ws/voices/?authorization=${encodeURIComponent(authHeader)}`;
            
            this.ws = new WebSocket(wsUrl);
            this.ws.binaryType = 'arraybuffer';
            
            this.ws.onopen = () => {
                uiHandler.updateStatus('connected', 'Connected');
                this.log('Connected successfully!', 'info');
                if (!this.audioContext) {
                    this.initAudioContext();
                }
                this.handleWebSocketOpen();
            };
            
            this.ws.onmessage = async (event) => {
                try {
                    if (!this.uid) {
                        const message = JSON.parse(event.data);
                        if (message.type === "UID") {
                            this.uid = message.uid;
                            this.log(`UID: ${this.uid}`, 'info');
                        }
                    }
                    this.handleWebSocketMessage(event);
                } catch (error) {
                    this.log(`Error handling message: ${error.message}`, 'error');
                }
            };

            
            this.ws.onerror = (error) => {
                uiHandler.updateStatus('error', 'Error');
                this.log(`WebSocket Error: ${error.message}`, 'error');
            };
            
            this.ws.onclose = () => {
                uiHandler.updateStatus('', 'Disconnected');
                this.log('Connection closed', 'error');
                this.stopAudio(false);
            };
            
        } catch (error) {
            uiHandler.updateStatus('error', 'Error');
            this.log(`Connection Error: ${error.message}`, 'error');
        }
    }
    
    disconnect() {
        try{
            if (this.ws) {
                this.ws.close();
                this.ws = null;
                this.stopAudio(true);
            }
        } catch (error) {
            this.log(`Error disconnecting: ${error.message}`, 'error');
        }
    }
    
    formatJSON() {
        try {
            const jsonText = this.jsonInput.value.trim();
            if (jsonText) {
                const parsed = JSON.parse(jsonText);
                this.jsonInput.value = JSON.stringify(parsed, null, 2);
                this.jsonInput.classList.remove('json-error');
            }
        } catch (error) {
            this.jsonInput.classList.add('json-error');
            this.log(`Invalid JSON: ${error.message}`, 'error');
        }
    }
    
    sendMessage() {
        try{

            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                this.log('Cannot send message: Not connected to server', 'error');
                return;
            }
            
            const jsonText = this.jsonInput.value.trim();
            if (jsonText) {
            try {
                // Validate JSON before sending
                const jsonData = JSON.parse(jsonText);
                this.ws.send(JSON.stringify(jsonData));
                this.log(`Sent: ${JSON.stringify(jsonData)}`, 'info');
                // Optionally clear the input after sending
                // this.jsonInput.value = '';
            } catch (error) {
                this.jsonInput.classList.add('json-error');
                    this.log(`Failed to send message: Invalid JSON - ${error.message}`, 'error');
                }
            }
        } catch (error) {
            this.log(`Error sending message: ${error.message}`, 'error');
        }
    }

    handleWebSocketMessage(event) {
        try{
            const arrayBuffer = event.data;
            if (this.isPlaying) {
                this.enqueueAudioFromProto(arrayBuffer);
            }
        } catch (error) {
            this.log(`Error handling WebSocket message: ${error.message}`, 'error');
        }
    }

    enqueueAudioFromProto(arrayBuffer) {
        try{
            const parsedFrame = this.Frame.decode(new Uint8Array(arrayBuffer));
            if (!parsedFrame?.audio) {
                return false;
            }

            const currentTime = this.audioContext.currentTime;
            if (this.playTime < currentTime) {
                this.playTime = currentTime;
            }

            const audioVector = Array.from(parsedFrame.audio.audio);
            const audioArray = new Uint8Array(audioVector);

            this.audioContext.decodeAudioData(audioArray.buffer, (buffer) => {
                const source = new AudioBufferSourceNode(this.audioContext, {
                    playbackRate: 1.0 // Ensure normal playback rate
                });
                source.buffer = buffer;
            
                const scheduleDelay = 0.05; // 50ms scheduling delay
                const startTime = Math.max(this.playTime, currentTime + scheduleDelay);
            
                source.start(startTime);
                source.connect(this.audioContext.destination);
            
                this.playTime = startTime + buffer.duration;
            }).catch(error => {
                this.log(`Audio decoding error: ${error}`, 'error');
            });
        } catch (error) {
            this.log(`Error enqueuing audio from proto: ${error.message}`, 'error');
        }
    }

    handleWebSocketOpen(event) {
        try{
            console.log('WebSocket connection established.', event)

            navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: this.SAMPLE_RATE,
                    channelCount: this.NUM_CHANNELS,
                    autoGainControl: true,
                    echoCancellation: true,
                    noiseSuppression: true,
                }
            }).then((stream) => {
                this.microphoneStream = stream;
                // 512 is closest thing to 200ms.
                this.scriptProcessor = this.audioContext.createScriptProcessor(512, 1, 1);
                this.source = this.audioContext.createMediaStreamSource(stream);
                this.source.connect(this.scriptProcessor);
                this.scriptProcessor.connect(this.audioContext.destination);

                this.scriptProcessor.onaudioprocess = (event) => {
                    if (!this.ws) {
                        return;
                    }

                    const audioData = event.inputBuffer.getChannelData(0);
                    const pcmS16Array = this.convertFloat32ToS16PCM(audioData);
                    const pcmByteArray = new Uint8Array(pcmS16Array.buffer);
                    const frame = this.Frame.create({
                        audio: {
                            audio: Array.from(pcmByteArray),
                            sampleRate: this.SAMPLE_RATE,
                            numChannels: this.NUM_CHANNELS
                        }
                    });
                    const encodedFrame = new Uint8Array(this.Frame.encode(frame).finish());
                    this.ws.send(encodedFrame);
                };
            }).catch((error) => console.error('Error accessing microphone:', error));
        } catch (error) {
            this.log(`Error accessing microphone: ${error.message}`, 'error');
        }
    }
    
    convertFloat32ToS16PCM(float32Array) {
        try{
            let int16Array = new Int16Array(float32Array.length);

            for (let i = 0; i < float32Array.length; i++) {
                let clampedValue = Math.max(-1, Math.min(1, float32Array[i]));
                int16Array[i] = clampedValue < 0 ? clampedValue * 32768 : clampedValue * 32767;
            }
            return int16Array;
        } catch (error) {
            this.log(`Error converting float32 to s16pcm: ${error.message}`, 'error');
        }
    }

    stopAudio(closeWebsocket) {
        try{
            this.playTime = 0;
            this.isPlaying = false;

            if (this.ws && closeWebsocket) {
                this.ws.close();
                this.ws = null;
            }

            // Properly cleanup audio resources
            if (this.scriptProcessor) {
                this.scriptProcessor.disconnect();
                this.scriptProcessor = null;
            }
            
            if (this.source) {
                this.source.disconnect();
                this.source = null;
            }

            // Stop all microphone tracks
            if (this.microphoneStream) {
                this.microphoneStream.getTracks().forEach(track => track.stop());
                this.microphoneStream = null;
            }
        } catch (error) {
            this.log(`Error stopping audio: ${error.message}`, 'error');
        }
    }


}

// Initialize UI handler
const uiHandler = new HandleUI();
