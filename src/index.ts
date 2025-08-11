import { AppServer, AppSession, ViewType, StreamType, DashboardMode } from '@mentra/sdk';
import { ShazamClient, SongInfo } from './shazam-client';

const PACKAGE_NAME = process.env.PACKAGE_NAME ?? (() => { throw new Error('PACKAGE_NAME is not set in .env file'); })();
const MENTRAOS_API_KEY = process.env.MENTRAOS_API_KEY ?? (() => { throw new Error('MENTRAOS_API_KEY is not set in .env file'); })();
const PORT = parseInt(process.env.PORT || '3000');

class ShazamMentraOSApp extends AppServer {
  private isListening = false;
  private isProcessing = false;
  private songHistory: SongInfo[] = [];
  private lastSong: SongInfo | null = null;
  private audioChunks: ArrayBuffer[] = [];
  private audioChunkTimer: NodeJS.Timeout | null = null;
  private chunkCount = 0;
  private totalAudioBytes = 0;
  private shazamClient: ShazamClient;
  private currentSession: AppSession | null = null;

  constructor() {
    super({
      packageName: PACKAGE_NAME,
      apiKey: MENTRAOS_API_KEY,
      port: PORT,
    });
    this.shazamClient = new ShazamClient();
    console.log('🎵 Shazam Forever app initialized');
  }

  protected async onSession(session: AppSession, sessionId: string, userId: string): Promise<void> {
    console.log(`🎯 New session started: ${sessionId} for user: ${userId}`);

    // Store the current session for UI updates
    this.currentSession = session;

    // Subscribe to audio chunks
    console.log('🔊 Subscribing to audio chunks...');
    session.subscribe(StreamType.AUDIO_CHUNK);

    // Set up the main UI (minimal)
    this.setupMainUI(session);

    // Set up dashboard content
    this.updateDashboard(session);

    // Handle audio chunks for real-time recording
    session.events.onAudioChunk((data) => {
      this.handleAudioChunk(session, data);
    });

    // Handle battery updates
    session.events.onGlassesBattery((data) => {
      console.log('🔋 Glasses battery:', data.level + '%', data.charging ? '(charging)' : '');
    });

    // Listen for dashboard mode changes
    const unsubscribe = session.dashboard.content.onModeChange((mode) => {
      console.log(`Dashboard mode changed to: ${mode}`);
      this.updateDashboard(session);
    });

    // Start listening immediately
    this.startListening(session);
  }

  private setupMainUI(session: AppSession) {
    // Don't show anything in the main view - keep it clean
    // All information will be shown in the dashboard when user looks up
  }

  private updateDashboard(session: AppSession) {
    if (this.lastSong) {
      // Show current song in dashboard with more details
      const dashboardText = `Now Playing\n${this.lastSong.title}\nby ${this.lastSong.artist}\nAlbum: ${this.lastSong.album || 'Unknown'}`;

      // Write to main dashboard
      session.dashboard.content.writeToMain(dashboardText);
      
      // Write expanded version with even more details
      const expandedText = `Now Playing\n${this.lastSong.title}\nby ${this.lastSong.artist}\n\nAlbum: ${this.lastSong.album || 'Unknown'}\nTime: ${this.lastSong.timestamp.toLocaleTimeString()}\n\n${this.lastSong.spotifyUri ? '🎧 Available on Spotify' : ''}`;
      session.dashboard.content.writeToExpanded(expandedText);
    } else {
      // Show listening status in dashboard
      const dashboardText = this.isListening ? "Listening for music..." : "⏸️ Paused";
      session.dashboard.content.writeToMain(dashboardText);
      session.dashboard.content.writeToExpanded("🎵 Shazam Forever\n\nNo song currently playing\n\nListening for music in your environment...");
    }
  }

  private async startListening(session: AppSession) {
    if (this.isListening) {
      return;
    }

    this.isListening = true;
    console.log("🎧 Starting continuous music listening...");

    // Update main UI and dashboard
    this.setupMainUI(session);
    this.updateDashboard(session);
  }



  private handleAudioChunk(session: AppSession, data: any) {
    if (!this.isListening || this.isProcessing) {
      return;
    }

    // Add audio chunk to buffer
    this.audioChunks.push(data.arrayBuffer);
    this.chunkCount++;
    this.totalAudioBytes += data.arrayBuffer.byteLength;

    console.log(`🎵 Audio chunk received: ${data.arrayBuffer.byteLength} bytes (total: ${this.totalAudioBytes} bytes, chunks: ${this.chunkCount})`);

    // Update UI periodically to show chunk count
    if (this.chunkCount % 10 === 0) {
      this.updateUI();
    }

    // If we don't have a timer running, start one
    if (!this.audioChunkTimer) {
      console.log('⏰ Starting 10-second timer for audio processing...');
      this.audioChunkTimer = setTimeout(() => {
        this.processAudioChunks(session);
      }, 10000); // Process every 10 seconds of audio
    }
  }

  private async processAudioChunks(session: AppSession) {
    if (this.audioChunks.length === 0) {
      this.audioChunkTimer = null;
      return;
    }

    this.isProcessing = true;
    console.log(`🔍 Processing ${this.audioChunks.length} audio chunks (${this.totalAudioBytes} total bytes)...`);

    // Update UI to show processing
    this.updateUI();

    try {
      // Combine all audio chunks into one buffer
      const totalLength = this.audioChunks.reduce((acc, chunk) => acc + chunk.byteLength, 0);
      const combinedBuffer = new ArrayBuffer(totalLength);
      const combinedView = new Uint8Array(combinedBuffer);
      
      let offset = 0;
      for (const chunk of this.audioChunks) {
        combinedView.set(new Uint8Array(chunk), offset);
        offset += chunk.byteLength;
      }

      console.log(`🎵 Combined audio buffer: ${totalLength} bytes`);

      // Convert to the format expected by Shazam (16-bit PCM samples)
      const audioData = this.convertToPCM(combinedBuffer);

      console.log(`🎵 Converted to ${audioData.length} PCM samples`);

      // Send to Shazam for identification
      const songInfo = await this.identifySong(audioData);
      
      if (songInfo) {
        await this.handleSongIdentified(session, songInfo);
      } else {
        console.log("❌ No song identified in this sample");
      }

    } catch (error) {
      console.error("❌ Error processing audio chunks:", error);
    } finally {
      // Clear the audio chunks buffer
      this.audioChunks = [];
      this.audioChunkTimer = null;
      this.isProcessing = false;
      this.chunkCount = 0;
      this.totalAudioBytes = 0;

      // Update UI back to listening state
      this.updateUI();
    }
  }

  private updateUI() {
    if (this.currentSession) {
      this.setupMainUI(this.currentSession);
      this.updateDashboard(this.currentSession);
    }
  }

  private convertToPCM(arrayBuffer: ArrayBuffer): number[] {
    // Convert ArrayBuffer to 16-bit PCM samples
    const view = new Int16Array(arrayBuffer);
    const samples: number[] = [];
    
    for (let i = 0; i < view.length; i++) {
      // Convert to float between -1 and 1
      samples.push(view[i] / 32768.0);
    }
    
    return samples;
  }

  private async identifySong(audioSamples: number[]): Promise<SongInfo | null> {
    try {
      return await this.shazamClient.recognizeSong(audioSamples);
    } catch (error) {
      console.error("❌ Error identifying song:", error);
      return null;
    }
  }

  private async handleSongIdentified(session: AppSession, songInfo: SongInfo) {
    console.log(`🎵 Song identified: ${songInfo.title} by ${songInfo.artist}`);

    // Check if this is a duplicate of the last song
    const isDuplicate = this.lastSong && 
      this.lastSong.title === songInfo.title && 
      this.lastSong.artist === songInfo.artist &&
      (new Date().getTime() - this.lastSong.timestamp.getTime()) < 60000; // Within 1 minute

    if (isDuplicate) {
      console.log("🔄 Duplicate song detected, skipping...");
      return;
    }

    // Update last song
    this.lastSong = songInfo;

    // Add to history
    this.songHistory.unshift(songInfo);
    if (this.songHistory.length > 10) {
      this.songHistory.pop();
    }

    console.log(`📜 Song history updated (${this.songHistory.length} songs)`);

    // Update the dashboard immediately with new song
    this.updateDashboard(session);
  }
}

// Start the server
console.log('🚀 Starting Shazam Forever app...');
const app = new ShazamMentraOSApp();

app.start().catch(console.error);