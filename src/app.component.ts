import { ChangeDetectionStrategy, Component, effect, inject, signal, viewChild, ElementRef, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeminiService, CassetteData, Track } from './services/gemini.service';

const SOUR_AUDIO_URLS = [
    // A new, curated list of reliable, hotlink-friendly MP3s from stable CDNs like Mixkit and Bensound.
    'https://www.bensound.com/bensound-music/bensound-memories.mp3',
    'https://www.bensound.com/bensound-music/bensound-creativeminds.mp3',
    'https://www.bensound.com/bensound-music/bensound-acousticbreeze.mp3',
    'https://www.bensound.com/bensound-music/bensound-memories.mp3',
    'https://www.bensound.com/bensound-music/bensound-creativeminds.mp3',
    'https://www.bensound.com/bensound-music/bensound-acousticbreeze.mp3',
    'https://www.bensound.com/bensound-music/bensound-memories.mp3',
    'https://www.bensound.com/bensound-music/bensound-creativeminds.mp3',
    'https://www.bensound.com/bensound-music/bensound-acousticbreeze.mp3', 
    'https://www.bensound.com/bensound-music/bensound-memories.mp3',
];

const SOUR_ALBUM_DATA: CassetteData = {
  title: 'SOUR',
  artist: 'Olivia Rodrigo',
  description: 'The debut studio album by American singer-songwriter Olivia Rodrigo, released on May 21, 2021. A pop, pop-punk, and alternative-pop record, Sour is thematically centered on the perils of romance, heartbreak, and scorn.',
  albumCoverUrl: 'https://m.media-amazon.com/images/I/71Te1V90YDL._UF1000,1000_QL80_.jpg',
  tracks: [
    { title: 'brutal', url: SOUR_AUDIO_URLS[0] },
    { title: 'traitor', url: SOUR_AUDIO_URLS[1] },
    { title: 'drivers license', url: SOUR_AUDIO_URLS[2] },
    { title: '1 step forward, 3 steps back', url: SOUR_AUDIO_URLS[3] },
    { title: 'deja vu', url: SOUR_AUDIO_URLS[4] },
    { title: 'good 4 u', url: SOUR_AUDIO_URLS[5] },
    { title: 'enough for you', url: SOUR_AUDIO_URLS[6] },
    { title: 'happier', url: SOUR_AUDIO_URLS[7] },
    { title: 'jealousy, jealousy', url: SOUR_AUDIO_URLS[8] },
    { title: 'favorite crime', url: SOUR_AUDIO_URLS[9] },
    { title: 'hope ur ok', url: SOUR_AUDIO_URLS[0] },
  ]
};

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  private geminiService = inject(GeminiService);

  isLoading = signal<boolean>(false);
  error = signal<string | null>(null);
  cassetteData = signal<CassetteData | null>(null);
  isPlaying = signal<boolean>(false);
  currentTrackIndex = signal<number | null>(null);

  // Audio state signals
  currentTime = signal<number>(0);
  duration = signal<number>(0);
  volume = signal<number>(0.75);

  // Signals and properties for 3D rotation
  isDragging = signal(false);
  rotateX = signal(10); // initial rotation
  rotateY = signal(-15); // initial rotation
  private initialMouseX = 0;
  private initialMouseY = 0;
  private initialRotateX = 0;
  private initialRotateY = 0;

  audioPlayer = viewChild<ElementRef<HTMLAudioElement>>('audioPlayer');

  currentTrack = computed(() => {
    const data = this.cassetteData();
    const index = this.currentTrackIndex();
    if (data && index !== null && data.tracks[index]) {
      return data.tracks[index];
    }
    return null;
  });

  cassetteTransform = computed(() => {
    return `rotateX(${this.rotateX()}deg) rotateY(${this.rotateY()}deg)`;
  });

  canPlayPrevious = computed(() => {
    const currentIndex = this.currentTrackIndex();
    const tracks = this.cassetteData()?.tracks;
    if (currentIndex === null || !tracks) return false;
    
    for (let i = currentIndex - 1; i >= 0; i--) {
        if (tracks[i].url) return true;
    }
    return false;
  });

  canPlayNext = computed(() => {
    const currentIndex = this.currentTrackIndex();
    const tracks = this.cassetteData()?.tracks;
    if (!tracks) return false;

    if (currentIndex === null) {
      return tracks.some(t => t.url);
    }
    
    for (let i = currentIndex + 1; i < tracks.length; i++) {
        if (tracks[i].url) return true;
    }
    return false;
  });
  
  private readonly loadingMessages = [
    "Dusting off the 8-track...",
    "Searching for the perfect mixtape...",
    "Rewinding to the good old days...",
    "Calibrating the sonic oscillators...",
    "Polishing the chrome finish...",
    "Designing the album art..."
  ];
  currentLoadingMessage = signal<string>(this.loadingMessages[0]);
  private messageInterval: any;

  constructor() {
    this.cassetteData.set(SOUR_ALBUM_DATA);

    // Effect for loading messages
    effect(() => {
        if (this.isLoading()) {
            this.messageInterval = setInterval(() => {
                const randomIndex = Math.floor(Math.random() * this.loadingMessages.length);
                this.currentLoadingMessage.set(this.loadingMessages[randomIndex]);
            }, 2000);
        } else {
            clearInterval(this.messageInterval);
        }
    });

    // Effect for handling audio playback
    effect(() => {
      const audio = this.audioPlayer()?.nativeElement;
      if (!audio) return;

      const track = this.currentTrack();
      const playing = this.isPlaying();

      // If the track has changed, update the source and explicitly load it.
      if (track?.url && audio.src !== track.url) {
        audio.src = track.url;
        audio.load();
      } else if (!track) {
        // If there's no track, clear the source and ensure it's paused.
        audio.pause();
        audio.src = '';
        return;
      }
      
      // Now, handle the play/pause state.
      if (playing) {
        // The play() method returns a promise which should be handled.
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            // A frequent cause for this error is an interruption by a user action (e.g., pause).
            // We can check if we are still meant to be playing. If not, the error is benign.
            if (!this.isPlaying()) {
              console.log("Play was interrupted as expected.");
            } else {
              console.error("Audio play failed:", error);
              // If the playback failed unexpectedly, update the state to reflect that.
              this.isPlaying.set(false);
            }
          });
        }
      } else {
        audio.pause();
      }
    });
    
    // Effect to set initial volume
    effect(() => {
      const audio = this.audioPlayer()?.nativeElement;
      if(audio) {
        audio.volume = this.volume();
      }
    });
  }

  async generateCassette(): Promise<void> {
    this.stop();
    this.currentTrackIndex.set(null);
    this.isLoading.set(true);
    this.cassetteData.set(null);
    this.error.set(null);

    try {
      const newMixtapeData = await this.geminiService.generateCassetteDetails();

      // Ensure every generated track has a playable audio source.
      const playableTracks = newMixtapeData.tracks.map(track => {
        const randomAudioUrl = SOUR_AUDIO_URLS[Math.floor(Math.random() * SOUR_AUDIO_URLS.length)];
        return { ...track, url: randomAudioUrl };
      });

      this.cassetteData.set({
        ...newMixtapeData,
        tracks: playableTracks
      });
      
    } catch (err) {
      console.error(err);
      this.error.set('Failed to connect to the retro-verse. Please check your connection and try again.');
    } finally {
      this.isLoading.set(false);
    }
  }

  playTrack(index: number): void {
    if (this.cassetteData()?.tracks[index]?.url) {
        if (this.currentTrackIndex() === index) {
            this.togglePlay();
        } else {
            this.currentTrackIndex.set(index);
            this.isPlaying.set(true);
        }
    } else {
        console.log("No audio URL for this track.");
    }
  }

  togglePlay(): void {
     // If no track is selected, start with the first one that has a URL
    if (this.currentTrackIndex() === null) {
      const firstPlayableIndex = this.cassetteData()?.tracks.findIndex(t => t.url) ?? -1;
      if (firstPlayableIndex !== -1) {
        this.currentTrackIndex.set(firstPlayableIndex);
        this.isPlaying.set(true);
      }
    } else {
       this.isPlaying.update(p => !p);
    }
  }

  stop(): void {
    this.isPlaying.set(false);
    const audio = this.audioPlayer()?.nativeElement;
    if (audio) {
      audio.currentTime = 0;
    }
  }

  playNextTrack(): void {
    const currentIndex = this.currentTrackIndex();
    const tracks = this.cassetteData()?.tracks;
    if (!tracks || tracks.length === 0) {
      this.stop();
      return;
    }

    let nextIndex = (currentIndex === null) ? 0 : currentIndex + 1;

    // Find the next track that has a URL
    while(nextIndex < tracks.length && !tracks[nextIndex].url) {
      nextIndex++;
    }

    if (nextIndex < tracks.length) {
      this.currentTrackIndex.set(nextIndex);
      this.isPlaying.set(true);
    } else {
      // End of playlist
      this.stop();
      this.currentTrackIndex.set(null);
    }
  }

  playPreviousTrack(): void {
    const currentIndex = this.currentTrackIndex();
    const tracks = this.cassetteData()?.tracks;
    if (currentIndex === null || !tracks) {
        return;
    }

    let prevIndex = currentIndex - 1;
    // Find the previous track that has a URL
    while(prevIndex >= 0 && !tracks[prevIndex].url) {
      prevIndex--;
    }

    if (prevIndex >= 0) {
        this.currentTrackIndex.set(prevIndex);
        this.isPlaying.set(true);
    }
  }

  onTimeUpdate(event: Event): void {
    const audio = event.target as HTMLAudioElement;
    this.currentTime.set(audio.currentTime);
    this.duration.set(audio.duration || 0);
  }

  onVolumeChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const newVolume = parseFloat(input.value) / 100;
    this.volume.set(newVolume);
    const audio = this.audioPlayer()?.nativeElement;
    if (audio) {
      audio.volume = newVolume;
    }
  }

  onSeek(event: Event): void {
    const input = event.target as HTMLInputElement;
    const newTime = parseFloat(input.value);
    const audio = this.audioPlayer()?.nativeElement;
    if (audio) {
      audio.currentTime = newTime;
      this.currentTime.set(newTime);
    }
  }

  formatTime(seconds: number): string {
    if (isNaN(seconds) || seconds < 0) {
      return '00:00';
    }
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }


  // Methods for drag-to-rotate functionality
  onMouseDown(event: MouseEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
    this.initialMouseX = event.clientX;
    this.initialMouseY = event.clientY;
    this.initialRotateX = this.rotateX();
    this.initialRotateY = this.rotateY();
  }

  onMouseMove(event: MouseEvent): void {
    if (!this.isDragging()) return;

    const deltaX = event.clientX - this.initialMouseX;
    const deltaY = event.clientY - this.initialMouseY;

    const sensitivity = 0.25;

    // Invert deltaY for natural vertical rotation
    const newRotateX = this.initialRotateX - deltaY * sensitivity;
    const newRotateY = this.initialRotateY + deltaX * sensitivity;

    // Clamp X-axis rotation to a reasonable range to avoid flipping
    this.rotateX.set(Math.max(-60, Math.min(60, newRotateX)));
    this.rotateY.set(newRotateY);
  }

  onMouseUp(): void {
    this.isDragging.set(false);
  }

  onMouseLeave(): void {
    // Also stop dragging if the mouse leaves the component's main area
    this.isDragging.set(false);
  }
}