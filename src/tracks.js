// The playlist is hardcoded for phase 1 — no upload UI (see the spec's YAGNI list).
//
// `mood` is the seam for phase 2, where the car interior changes with the song.
// Nothing reads it yet: every track is `neutral`, which is the one interior
// phase 1 ships. Real labels get set when phase 2 is designed.

export const TRACKS = [
  {
    title: 'Lost',
    artist: 'Frank Ocean',
    url: 'assets/audio/Frank Ocean - Lost.mp3',
    mood: 'neutral',
  },
  {
    title: 'Thinkin Bout You',
    artist: 'Frank Ocean',
    url: 'assets/audio/Frank Ocean - Thinkin Bout You (Spring Sampler _ 2012).mp3',
    mood: 'neutral',
  },
  {
    title: 'Godspeed',
    artist: 'Frank Ocean',
    url: 'assets/audio/Frank Ocean - Godspeed.mp3',
    mood: 'neutral',
  },
  {
    title: 'New Again',
    artist: 'Kanye West',
    url: 'assets/audio/Kanye West - New Again.mp3',
    mood: 'neutral',
  },
  {
    title: 'In My Feelings',
    artist: 'Lana Del Rey',
    url: 'assets/audio/Lana Del Rey - In My Feelings.mp3',
    mood: 'neutral',
  },
  {
    title: 'Ordinary Life',
    artist: 'The Weeknd',
    url: 'assets/audio/The Weeknd - Ordinary Life.mp3',
    mood: 'neutral',
  },
];
