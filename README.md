# tech.sex

Paste a document, get a quiz, track what sticks. A static learning tracker built with React and Vite.

## How it works

1. Paste a document (notes, an article, a chapter) into a new track.
2. `src/generate.js` streams a quiz from the keyless OpenAI-compatible endpoint at
   `https://llm.elimelt.com/v1` (`gpt-oss:20b`). The model emits JSON Lines, so
   questions appear one by one. Question count scales with document length (4-10),
   roughly one third free-response.
3. Multiple-choice answers are checked locally. Free-response answers are graded by
   the same endpoint against a per-question rubric (`src/grade.js`), scored 0-2 with
   one sentence of feedback. Grading runs in the background while the user keeps
   answering. If the grader fails, the question is excluded from the total instead
   of counting against the user.
4. Tracks, questions, and attempt history persist in IndexedDB (`src/db.js`).
   Nothing leaves the browser except the document (once, for generation) and
   free-response answers (once each, for grading). Nothing is stored server-side.

There is no backend and no credentials. Do not point this client at an endpoint
that needs an API key.

## Develop

```bash
npm install
npm run dev
npm test
```

Pure logic (question parsing, grade parsing, attempt scoring) lives in
`src/generate.js`, `src/grade.js`, and `src/attempts.js` and is covered by
`node --test`.

## Deploy

Push to `main`. GitHub Actions builds and deploys to GitHub Pages.
