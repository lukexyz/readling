# Readling · The Word Woods

Serve `dist/` with any static web server. Progress, drawings and earned cards are saved in the player's browser. A grown-up can also sign in with Google to keep a copy in their account, once that is set up as described below.

The public game plays bundled audio files. It has no speech-generation endpoint and needs no hosted credentials.

To change the narration, edit the prompts in `dist/voice-lines.js` or the word list and stories in `dist/game.js`. With Node.js and FFmpeg installed, run:

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
- `dist/show-scenes.js` draws the star, the sky, the rainbow, the ground and the parts made from her finds. `dist/show-creatures.js` draws the bunnies, dolphins, whale, elephants and snail. `dist/show-kit.js` holds the colours and shapes they share.

To add something new, give it an entry in `SHOW`, write its part in one of the two drawing files, and add its name to the right group at the top of `dist/finale.js`. A part is a length in seconds, a drawing order and a `draw` function. Grown-ups has a try-out mode, where any mix of parts can be ticked and played without changing her show, and each part can be watched by itself. It also reports how long the ticked show runs and when each part plays, using `planShow` in `dist/finale.js`.

The show does not play when the device asks for reduced motion. The page then shows the picture, the rainbow she has added and the choices straight away.

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
