# Readling · The Word Woods

Serve `dist/` with any static web server. Progress, drawings and earned cards are saved in the player's browser. A grown-up can also sign in with Google to keep a copy in their account, once that is set up as described below.

The public game plays saved recordings. Open **Grown-ups → Audio studio** or `/audio-studio.html` to search and play the library. It opens on the short and full human takes of **b**. The current game take, the audition and the example word have separate play buttons.

For individual letter sounds, choose a pace and use **Generate sound preview**. The studio sends the catalogued phoneme to ElevenLabs Flash v2. Delivery notes are available for narration. A generated letter preview longer than 1.5 seconds is set aside and repeating that request uses the cached result. Both **b** and **d** also have a full human take ready to audition.

The studio uses the same public Site. Sign in with the owner's ChatGPT account to give ElevenLabs a delivery direction or upload audio. **Generate preview** creates a cached draft with the configured voice. **Use in game** switches the public recording. For a slow blend, set the two letter-change times in seconds before using the take. **Compare bundled original** can restore the shipped sound. Public game playback and preview replays read audio files.

The Sites Worker reads the runtime secrets `AUDIO_OWNER_EMAIL` and `ELEVENLABS_API_KEY`. The former is the email of the owner reported by Sites. Owner checks use the identity supplied by Sites on each editing request. R2 holds drafts, the active recording for each clip and blend timings. The original library stays in source. The Worker serves the existing URLs, including byte ranges for tablet players. The studio levels uploaded and generated audio before auditioning it. Run `npm run build` to build the Worker from `worker/audio.js` and `dist/`.

To update the bundled narration, edit the prompts in `dist/voice-lines.js` or the word list and stories in `dist/game.js`. With Node.js and FFmpeg installed, run:

```sh
npm run voices -- --key-file "/path/to/your/local/key-file"
npm test
```

Keep the key outside the repository. The publisher can also read the local `ELEVENLABS_API_KEY` environment variable. It only requests missing recordings for the selected voice and text, then matches their volume to the rest of the game. Commit the updated MP3s and catalogue before publishing. Replays and subsequent builds with unchanged lines use the saved recordings.

`npm test` first checks the memory schedule in `dist/game.js` with `scripts/schedule.test.mjs`, the combining and packing of albums with `scripts/album.test.mjs` and the rules for her show with `scripts/show.test.mjs`, then confirms every recording is present. All three sets of checks use words from the first collection, so update them if those words change.

## Her celebration show

Each new find and each finished memory round ends with a show that she builds herself. `MUSINGS.md` explains why it works the way it does.

- `dist/game.js` holds the list of things she can add, in the order they are offered, as `SHOW`. It also decides when a choice is due and which two things are offered. Her show is saved in her album as `show`, and two tablets keep everything added on either.
- `dist/finale.js` runs the show: the hush, her letters, the order of the parts, her stars and the rosette. It also draws the small previews on the choices.
- `dist/show-scenes.js` draws the star, the sky, the rainbow, the ground and the parts made from her finds. `dist/show-creatures.js` draws the bunnies and elephants. `dist/show-kit.js` holds the colours and shapes they share.
- Dolphins share a visitor slot. Regular shows rotate between the highest earned Porpoise skip, Skyward vault and Silver relay. Existing Dolphins picks unlock the first skip. Silver relay progresses straight from Long glide to Pod in flight. The gallery uses stills from the same transparent Blender frames as the game.
- `/new-celebrations.html` compares the three levels of each plant and the ocean animations. Each family can play together or scrub individually. Poppies, moonflowers and sunflowers each unlock through three levels. Each earned family grows its highest level alongside the others. An album with the original Flowers already owns Scarlet poppies level 1. The existing Oak reward plays the mature tree from `studies/flowers/oak.py`.
- The Ember Orca has three levels. The highest earned level plays in a single finale slot. Existing Whale picks count as level 1. `dist/ember-breach.js` plays the transparent Blender plates made by `studies/ember-orca/progression.py`. The orca mesh and the adapted whale rig are both CC0. [Innerscene model](https://www.innerscene.com/tools/library/3d-parts/killer-whale-orca-d98788fe) · [Quaternius rig](https://poly.pizza/m/JGFwp6xWgk)

To add something new, give it an entry in `SHOW`, write its part in one of the two drawing files, and add its name to the right group at the top of `dist/finale.js`. A part is a length in seconds, a drawing order and a `draw` function. Grown-ups has a try-out mode, where any mix of parts can be ticked and played without changing her show, and each part can be watched by itself. It also reports how long the ticked show runs and when each part plays, using `planShow` in `dist/finale.js`.

The show does not play when the device asks for reduced motion. The page then shows the picture, the rainbow she has added and the choices straight away.

### Publishing new celebration artwork

Local previews serve the images from `dist/assets`. On Sites, the Worker reads the dolphin, orca and garden WebP files from the existing R2 bucket, addressed by their SHA-256 hashes. Previously uploaded pictures are reusable across releases. To populate new pictures, generate a random 32-byte hex grant and build with `READLING_ART_VERIFIER` set to the SHA-256 of its UTF-8 hex string and `READLING_ART_UNTIL` set to a near-future Unix timestamp in milliseconds. After deploying, run `node scripts/release-art.mjs` from the published checkout and supply the grant on stdin. It verifies every picture against the live URL. Keep the grant out of source control.

## Saving progress to a Google account

This is on while `dist/cloud-config.js` holds the settings of a Firebase project. It now holds those of the project `readling-6f8ec`. Set `FIREBASE` to `null` there and the game shows no sign-in and fetches nothing from Google.

While it is on, the page that celebrates a finished collection of three words shows one "Sign in with Google" button, and Grown-ups always has it. After a grown-up signs in, the album is kept in one Firestore document for that Google account, at `albums/<user id>`. Each save reads that document first and combines it with the album on the tablet, so two tablets that have both been played on keep every find. Signing out leaves the album on the tablet.

To set it up, in the [Firebase console](https://console.firebase.google.com):

1. Create a project. It does not need Google Analytics.
2. Open Authentication, choose Get started, then enable Google under Sign-in method.
3. Under Authentication, Settings, Authorized domains, add the address the game is served from, without `https://`. `localhost` is already listed.
4. Open Firestore Database and create a database in production mode. On its Rules tab, publish the rules below.
5. In Project settings, under Your apps, add a Web app. Copy its `apiKey`, `authDomain`, `projectId` and `appId` into `dist/cloud-config.js`.
6. Publish the Site.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /albums/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

The values in `dist/cloud-config.js` identify the project and are meant to be public. The rules are what keep each album private to its own account.

The saved document holds the album as text: the words found, the progress of each sound, her handwriting, stars and settings. Firebase Authentication also keeps the Google name, email address and picture address of each grown-up who signs in. Both can be viewed and deleted in the Firebase console. The game has no button for deleting the saved copy.

Google's sign-in window names the project's `firebaseapp.com` address, because the sign-in runs there. The Google libraries are loaded from `gstatic.com` at the version named in `dist/cloud.js`, and only when a sign-in button is on screen or someone has signed in on that device.
