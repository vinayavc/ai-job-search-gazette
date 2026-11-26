Drop royalty-free MP3/OGG files here to stock the diner radio.
Name them `jazz-*.mp3`, `lofi-*.mp3` or `rain-*.mp3` to put them on that station.
With no files, the radio plays a soft tune generated in the browser.
Personal audio files are gitignored; only this README is tracked.

Optional `playlist.json` (same folder) lists the records explicitly, e.g.
`[{ "station": "jazz", "file": "jazz-blue-hour.mp3" }, { "station": "rain", "file": "rain-window.ogg" }]`.
`station` is `jazz`, `lofi` or `rain`; `file` is relative to this folder. The radio shuffles a
station's files with a gentle crossfade, and falls back to the in-browser tune when a station has none.

## Live stations

Optional `stations.json` (same folder, gitignored) adds live internet radio to the dial, e.g.
`[{ "id": "wave983", "name": "WAVE 98.3", "url": "https://stream2.statsradio.com:8152/stream" }]`.
`id` is lowercase letters, digits and dashes; `url` is the station's own audio stream (Icecast or Shoutcast MP3/AAC),
not its web page. The stream has to allow cross-origin playback (most public streams do); if it doesn't, the station
stays silent. The radio reconnects on its own if a stream drops.
