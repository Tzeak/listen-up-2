# Shazam Forever - MentraOS App

A continuous music recognition app for MentraOS glasses that automatically listens to your environment and identifies songs using the Shazam API.

## Features

- 🎵 **Always-On Music Recognition**: Continuously listens for music automatically
- 🎧 **Real Audio Recording**: Uses MentraOS AudioChunk API for live audio processing
- 📜 **Song History**: Keep track of recently identified songs
- 🔋 **Battery Monitoring**: Get notified when glasses battery is low
- 🎨 **Album Art Display**: View album artwork for identified songs
- 🎤 **Hands-free Operation**: Perfect for use with smart glasses

## How It Works

The app automatically starts listening when you connect your glasses and continuously processes audio chunks every 5 seconds. When music is detected, it displays the song information including title, artist, genre, and album art.

### Status Indicators

- **🎧 Listening...** - Actively monitoring for music
- **🔍 Processing audio...** - Analyzing current audio sample
- **⏸️ Paused** - Not currently listening

## Setup

1. **Install Dependencies**:
   ```bash
   bun install
   ```

2. **Environment Variables**:
   Create a `.env` file with:
   ```
   PACKAGE_NAME=your-app-name
   MENTRAOS_API_KEY=your-mentraos-api-key
   PORT=3000
   ```

3. **Run the App**:
   ```bash
   bun run dev
   ```

4. **Deploy to MentraOS**:
   - Get your webhook URL from ngrok or your public URL
   - Configure the webhook in the [MentraOS Developer Console](https://console.mentra.glass/)
   - Enable microphone permissions in the console

## Technical Implementation

### Audio Processing
- **Real-time Audio**: Uses MentraOS AudioChunk API for continuous audio streaming
- **Chunk Processing**: Combines 5-second audio chunks for analysis
- **Shazam Integration**: Uses the `node-shazam` npm package for real song identification

### Architecture
- **Always-On**: Automatically starts listening when session begins
- **Event-Driven**: Processes audio chunks as they arrive
- **Non-Blocking**: Audio processing doesn't interfere with other operations

## Current Implementation

The current version includes:
- ✅ Real audio recording via AudioChunk API
- ✅ Always-on listening mode
- ✅ Real Shazam API integration via node-shazam package
- ✅ Song history tracking
- ✅ Status indicators (Listening/Processing)
- ✅ Error handling and logging

## File Structure

```
src/
├── index.ts          # Main MentraOS app with audio processing
└── shazam-client.ts  # Shazam API client
```

## Development

The app is built using:
- **TypeScript** for type safety
- **MentraOS SDK** for glasses integration
- **Bun** for fast development and runtime
- **node-shazam npm package** for real song identification

## AudioChunk API Usage

The app subscribes to audio chunks and processes them in real-time:

```typescript
// Subscribe to audio chunks
session.subscribe(StreamType.AUDIO_CHUNK);

// Handle incoming audio chunks
session.events.onAudioChunk((data) => {
  // Process audio data
  this.handleAudioChunk(session, data);
});
```

## License

ISC
