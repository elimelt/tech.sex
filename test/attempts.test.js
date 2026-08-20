import test from "node:test";
import assert from "node:assert/strict";
import { scoreAttempt, bestPercent } from "../src/attempts.js";
import { parseGrade } from "../src/grade.js";

const QUESTIONS = [
  { id: "q1", type: "choice", prompt: "?", options: ["a", "b", "c", "d"], correct: 1 },
  { id: "q2", type: "choice", prompt: "?", options: ["a", "b", "c", "d"], correct: 0 },
  { id: "q3", type: "text", prompt: "?", rubric: "r" },
];

test("scoreAttempt mixes choice and graded text answers", () => {
  const result = scoreAttempt(QUESTIONS, { q1: 1, q2: 3, q3: { text: "ans", grade: { score: 1, feedback: "partial" } } });
  assert.equal(result.points, 3);
  assert.equal(result.possible, 6);
  assert.equal(result.percent, 50);
  assert.deepEqual(result.rows.map(r => r.points), [2, 0, 1]);
});

test("scoreAttempt excludes ungraded text answers from the total", () => {
  const result = scoreAttempt(QUESTIONS, { q1: 1, q2: 0, q3: { text: "ans", grade: null } });
  assert.equal(result.possible, 4);
  assert.equal(result.percent, 100);
  assert.ok(result.rows[2].ungraded);
});

test("bestPercent returns null with no attempts", () => {
  assert.equal(bestPercent({ attempts: [] }), null);
  assert.equal(bestPercent({ attempts: [{ percent: 40 }, { percent: 75 }] }), 75);
});

test("parseGrade clamps and extracts embedded JSON", () => {
  assert.deepEqual(parseGrade('{"score": 2, "feedback": "good"}'), { score: 2, feedback: "good" });
  assert.equal(parseGrade('{"score": 9, "feedback": ""}').score, 2);
  assert.equal(parseGrade('{"score": -3}').score, 0);
  assert.equal(parseGrade('Sure: {"score": 1, "feedback": "ok"} done').score, 1);
  assert.throws(() => parseGrade("no json"));
  assert.throws(() => parseGrade('{"score": "great"}'));
});
