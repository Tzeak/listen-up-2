import { Shazam } from 'node-shazam';



export interface SongInfo {
  title: string;
  artist: string;
  album?: string;
  coverArtUrl?: string;
  spotifyUri?: string;
  timestamp: Date;
}

export class ShazamClient {
  private shazam: Shazam;

  constructor() {
    this.shazam = new Shazam();
  }

  async recognizeSong(audioSamples: number[]): Promise<SongInfo | null> {
    try {
      console.log("🎵 Sending audio to Shazam for identification...");
      
      // Convert audio samples to the format expected by node-shazam
      // node-shazam expects 16-bit PCM samples
      const pcmSamples = audioSamples.map(sample => Math.round(sample * 32767));
      
      // Use the real Shazam API
      const result = await this.shazam.fullRecognizeSong(pcmSamples);
      
      if (result && result.track) {
        console.log(`✅ Song identified: ${result.track.title} by ${result.track.subtitle}`);
        
        return {
          title: result.track.title || 'Unknown Title',
          artist: result.track.subtitle || 'Unknown Artist',
          album: this.extractAlbum(result.track),
          coverArtUrl: result.track.images?.coverart,
          spotifyUri: this.extractSpotifyUri(result.track),
          timestamp: new Date()
        };
      } else {
        console.log("❌ No song identified");
        return null;
      }

    } catch (error) {
      console.error("❌ Error identifying song:", error);
      return null;
    }
  }

  private extractAlbum(track: any): string {
    if (track.sections && track.sections[0] && track.sections[0].metapages && track.sections[0].metapages[1]) {
      return track.sections[0].metapages[1].caption || 'Unknown Album';
    }
    return 'Unknown Album';
  }

  private extractSpotifyUri(track: any): string | undefined {
    if (track.hub && track.hub.providers) {
      for (const provider of track.hub.providers) {
        if (provider.type === 'SPOTIFY') {
          for (const action of provider.actions || []) {
            if (action.name === 'hub:spotify:searchdeeplink') {
              return action.uri;
            }
          }
        }
      }
    }
    return undefined;
  }
}
