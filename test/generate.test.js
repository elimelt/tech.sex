import test from "node:test";
import assert from "node:assert/strict";
import { questionCount, parseQuestion, tryParseQuestion } from "../src/generate.js";

test("questionCount scales with document length within bounds", () => {
  assert.equal(questionCount("a few words"), 4);
  assert.equal(questionCount(Array(600).fill("word").join(" ")), 5);
  assert.equal(questionCount(Array(5000).fill("word").join(" ")), 10);
});

test("parseQuestion accepts valid choice and text questions", () => {
  const choice = parseQuestion('{"type":"choice","prompt":"What is TCP?","options":["a","b","c","d"],"correct":2,"why":"because"}');
  assert.deepEqual(choice, { type: "choice", prompt: "What is TCP?", options: ["a", "b", "c", "d"], correct: 2, why: "because" });
  const text = parseQuestion('{"type":"text","prompt":"Explain backoff.","rubric":"mentions retries and jitter"}');
  assert.deepEqual(text, { type: "text", prompt: "Explain backoff.", rubric: "mentions retries and jitter" });
});

test("parseQuestion rejects malformed questions", () => {
  assert.throws(() => parseQuestion('{"type":"choice","prompt":"x","options":["a","b"],"correct":0}'));
  assert.throws(() => parseQuestion('{"type":"choice","prompt":"x","options":["a","b","c","d"],"correct":4}'));
  assert.throws(() => parseQuestion('{"type":"text","prompt":"x"}'));
  assert.throws(() => parseQuestion('{"type":"essay","prompt":"x"}'));
});

test("tryParseQuestion skips junk lines and strips fences", () => {
  assert.equal(tryParseQuestion("Here are your questions:"), null);
  assert.equal(tryParseQuestion(""), null);
  assert.equal(tryParseQuestion('{"type":"choice","prompt":"x"}'), null);
  const fenced = tryParseQuestion('```json\n{"type":"text","prompt":"x","rubric":"y"}');
  assert.equal(fenced.type, "text");
});
