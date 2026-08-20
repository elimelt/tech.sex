# tech.sex

A static, privacy-friendly personality quiz platform built with React and Vite. Eight quizzes ship with the app, including a free-response quiz scored from a declarative keyword rubric. Answers never leave the browser.

## Develop

```bash
npm install
npm run dev
npm test
```

## Add a quiz

Quizzes are plain objects in `src/quizzes.js`; the UI and scoring engine require no quiz-specific code.

```js
{
  id: "example",
  glyph: "✦",
  color: "#697fa8",
  minutes: 3,
  title: "Your quiz title",
  description: "A one-line invitation.",
  axes: [{ id: "energy", left: "Reflective", right: "Expressive" }],
  questions: [{
    id: "weekend", type: "choice", prompt: "Your perfect Saturday?",
    options: [
      { value: "quiet", label: "A book and nowhere to be", scores: { energy: -2 } },
      { value: "crowd", label: "A room full of new people", scores: { energy: 2 } },
    ],
  }],
  outcomes: [
    { at: 20, title: "Quiet current", description: "…", insight: "…" },
    { at: 80, title: "Bright signal", description: "…", insight: "…" },
  ],
}
```

Each axis is normalized to `0–100`. Outcome `at` values describe the score each outcome best represents. Add as many axes as needed; option `scores` may contribute to several.

For free response, use `type: "text"` with a local rubric:

```js
{ id: "reflection", type: "text", prompt: "What do you tell yourself after a mistake?",
  rubric: { energy: { keywords: ["learn", "next time", "okay"], score: -2 } } }
```

The scoring boundary is `scoreQuiz(quiz, answers)` in `src/scoring.js`. A server-side LLM grader can later translate prose into the same axis-point shape without changing the quiz runner. Do not put provider credentials in this static client.

## Deploy

Push to `main`. GitHub Actions builds and deploys to GitHub Pages.
