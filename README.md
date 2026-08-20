# tech.sex

A static, privacy-friendly personality quiz platform built with React and Vite. Eight quizzes ship with the app, including a free-response quiz scored by an LLM rubric grader. Multiple-choice answers never leave the browser; free-response text is sent once to the grading endpoint and not stored.

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

For free response, use `type: "text"` with a `grading` block and a keyword `rubric` fallback:

```js
{ id: "reflection", type: "text", prompt: "What do you tell yourself after a mistake?",
  rubric: { energy: { keywords: ["learn", "next time", "okay"], score: -2 } },
  grading: {
    axis: "energy", scale: [-2, 2],
    criteria: "Left pole: … Right pole: …",
    anchors: [
      { text: "an example tender answer", score: -2 },
      { text: "an example demanding answer", score: 2 },
    ],
  } }
```

`src/grader.js` grades text answers with the keyless OpenAI-compatible endpoint at
`https://llm.elimelt.com/v1` (`gpt-oss:20b`). It sends the criteria and anchors as a
few-shot rubric at temperature 0 and expects `{"relevant": bool, "score": int}` back.
Grading starts the moment the user submits the answer and runs while they finish the
quiz, so results usually appear with no wait. Off-topic or gibberish answers score 0.
If the endpoint fails or times out (10s, 2 attempts), scoring falls back to the
keyword `rubric`; questions without a `grading` block use the keyword rubric only.

The scoring boundary is `scoreQuiz(quiz, answers)` in `src/scoring.js`. Text answers
arrive either as plain strings or as `{ text, grades }` objects; grades map onto the
same axis-point shape as choice options. Do not put provider credentials in this
static client; the endpoint must stay keyless.

## Deploy

Push to `main`. GitHub Actions builds and deploys to GitHub Pages.
