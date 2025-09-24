import { Injectable } from '@angular/core';
import { GoogleGenAI, Type } from '@google/genai';

export interface Track {
  title: string;
  url?: string;
}

export interface CassetteData {
  title: string;
  artist: string;
  description: string;
  tracks: Track[];
  albumCoverUrl?: string;
}

@Injectable({
  providedIn: 'root',
})
export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    // IMPORTANT: The API key is securely managed in the environment.
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error('API_KEY environment variable not set');
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  private async generateAlbumCover(title: string, artist: string, description: string): Promise<string> {
    const prompt = `Create a retro 80s synthwave album cover. Album title: '${title}'. Artist: '${artist}'. Vibe: ${description}. The style should be vaporwave, with neon grids, chrome, vibrant pinks and blues, and a nostalgic, futuristic feel. Do not include any text or words on the image. The image should be purely artistic and representative of the theme.`;

    try {
      const response = await this.ai.models.generateImages({
        model: 'imagen-3.0-generate-002',
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: '1:1',
        },
      });

      const base64ImageBytes = response.generatedImages[0].image.imageBytes;
      return `data:image/jpeg;base64,${base64ImageBytes}`;

    } catch (error) {
      console.error('Error generating album cover:', error);
      throw new Error('Failed to generate album cover from Gemini API.');
    }
  }


  async generateCassetteDetails(): Promise<CassetteData> {
    const prompt = `Generate a fictional 80s synthwave or vaporwave mixtape. I need a creative and cool-sounding title, an artist name (can be a cool alias), a short, evocative description of the mixtape's vibe, and a tracklist of 5 songs. The theme should be retro-futuristic, neon-soaked, and nostalgic. Format the response as JSON.`;

    try {
      const textResponse = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description: 'The creative title of the mixtape.',
              },
              artist: {
                type: Type.STRING,
                description: 'The fictional artist or alias name.',
              },
              description: {
                type: Type.STRING,
                description: 'A short, evocative description of the mixtape.',
              },
              tracks: {
                type: Type.ARRAY,
                items: {
                  type: Type.STRING,
                },
                description: 'An array of 5 fictional track titles.',
              },
            },
            required: ['title', 'artist', 'description', 'tracks'],
          },
        },
      });

      const jsonString = textResponse.text.trim();
      const apiData = JSON.parse(jsonString) as {
        title: string;
        artist: string;
        description: string;
        tracks: string[];
      };
      
      // Basic validation
      if (!apiData.title || !apiData.artist || !Array.isArray(apiData.tracks) || apiData.tracks.length === 0) {
        throw new Error("Received malformed data from API.");
      }

      const albumCoverUrl = await this.generateAlbumCover(apiData.title, apiData.artist, apiData.description);

      // Map to new structure
      const cassetteData: CassetteData = {
        ...apiData,
        tracks: apiData.tracks.map(title => ({ title: title })), // url will be undefined
        albumCoverUrl: albumCoverUrl,
      };

      return cassetteData;

    } catch (error) {
      console.error('Error calling Gemini API:', error);
      // It's better to throw the error so the component can handle it
      throw new Error('Failed to generate cassette details from Gemini API.');
    }
  }
}