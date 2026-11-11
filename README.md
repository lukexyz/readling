# Readling · The Word Woods

Serve `dist/` with any static web server. Progress, drawings and earned cards are saved in the player's browser.

The public game plays bundled audio files. It has no speech-generation endpoint and needs no hosted credentials.

To change the narration, edit the prompts in `dist/voice-lines.js` or the word list and stories in `dist/game.js`. With Node.js and FFmpeg installed, run:

```sh
npm run voices -- --key-file "/path/to/your/local/key-file"
npm test
```

Keep the key outside the repository. The publisher can also read the local `ELEVENLABS_API_KEY` environment variable. It only requests missing recordings for the selected voice and text, then matches their volume to the rest of the game. Commit the updated MP3s and catalogue before publishing. Replays and subsequent builds with unchanged lines use the saved recordings.
