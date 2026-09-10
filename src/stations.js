// Station presets. The player streams live internet radio rather than serving
// audio files: the whole conceit is a car radio, and streaming means the site
// never redistributes anyone's recordings.
//
// Every URL here is HTTPS on purpose — the site is served over HTTPS, and a
// browser blocks plain-HTTP media as mixed content.
//
// `mood` is the seam for phase 2, where the cabin changes with what is
// playing. Nothing reads it yet.

export const STATIONS = [
  {
    name: 'EUROPA PLUS',
    genre: 'POP · DANCE',
    url: 'https://online2.gkvr.ru:8001/europa_che_64.aac',
    mood: 'neutral',
  },
  {
    name: 'РУССКОЕ РАДИО',
    genre: 'RUSSIAN POP',
    url: 'https://rusradio.hostingradio.ru/rusradio96.aacp',
    mood: 'neutral',
  },
  {
    name: 'RADIO MAXIMUM',
    genre: 'ROCK · ALTERNATIVE',
    url: 'https://maximum.hostingradio.ru/maximum128.mp3',
    mood: 'neutral',
  },
  {
    name: 'DFM ДИСКАЧ 90-Х',
    genre: 'EURODANCE',
    url: 'https://dfm-disc90.hostingradio.ru/disc9096.aacp',
    mood: 'neutral',
  },
  {
    name: 'RADIO RECORD',
    genre: 'RUSSIAN MIX',
    url: 'https://radiorecord.hostingradio.ru/rus96.aacp',
    mood: 'neutral',
  },
  {
    name: 'HIT FM',
    genre: 'HITS',
    url: 'https://hitfm.hostingradio.ru/hitfm96.aacp',
    mood: 'neutral',
  },
  {
    name: 'INSTRUMENTAL JAZZ',
    genre: 'LATE NIGHT',
    url: 'https://jfm1.hostingradio.ru:14536/ijstream.mp3',
    mood: 'neutral',
  },
];
