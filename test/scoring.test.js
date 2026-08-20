import test from "node:test";
import assert from "node:assert/strict";
import { QUIZZES } from "../src/quizzes.js";
import { scoreQuiz } from "../src/scoring.js";
import { parseScore } from "../src/grader.js";

test("all example quizzes have valid unique templates", () => {
  assert.ok(QUIZZES.length >= 5 && QUIZZES.length <= 10);
  assert.equal(new Set(QUIZZES.map(q => q.id)).size, QUIZZES.length);
  for (const quiz of QUIZZES) {
    assert.ok(quiz.questions.length > 0);
    assert.ok(quiz.axes.length > 0);
    assert.ok(quiz.outcomes.length > 1);
    assert.equal(new Set(quiz.questions.map(q => q.id)).size, quiz.questions.length);
  }
});

test("every quiz completes with bounded axis results", () => {
  for (const quiz of QUIZZES) {
    const answers = Object.fromEntries(quiz.questions.map(q => [q.id, q.type === "text" ? "I learned and tried again" : q.options.at(-1).value]));
    const result = scoreQuiz(quiz, answers);
    assert.ok(result.title);
    assert.equal(result.axes.length, quiz.axes.length);
    result.axes.forEach(axis => assert.ok(axis.score >= 0 && axis.score <= 100));
  }
});

test("opposite choices produce opposite scores", () => {
  const quiz = QUIZZES[0];
  const low = Object.fromEntries(quiz.questions.map(q => [q.id, q.options[0].value]));
  const high = Object.fromEntries(quiz.questions.map(q => [q.id, q.options.at(-1).value]));
  assert.equal(scoreQuiz(quiz, low).axes[0].score, 0);
  assert.equal(scoreQuiz(quiz, high).axes[0].score, 100);
});

test("LLM-graded text answers drive axis points", () => {
  const quiz = QUIZZES.find(q => q.id === "inner-narrator");
  const tender = { mistake: {text: "it happens", status: "done", grades: {voice: -2}}, proud: {text: "I rested", status: "done", grades: {voice: -2}}, friend: "a", goal: "a" };
  const harsh = { mistake: {text: "so careless", status: "done", grades: {voice: 2}}, proud: {text: "never slipped", status: "done", grades: {voice: 2}}, friend: "d", goal: "d" };
  assert.equal(scoreQuiz(quiz, tender).axes[0].score, 0);
  assert.equal(scoreQuiz(quiz, harsh).axes[0].score, 100);
});

test("failed grading falls back to the keyword rubric", () => {
  const quiz = QUIZZES.find(q => q.id === "inner-narrator");
  const soft = { mistake: {text: "It is okay; I learned something", status: "failed"}, proud: {text: "tried and grew", status: "failed"}, friend: "a", goal: "a" };
  const hard = { mistake: {text: "I should do better, that was careless", status: "failed"}, proud: {text: "I finished", status: "failed"}, friend: "d", goal: "d" };
  assert.ok(scoreQuiz(quiz, soft).axes[0].score < scoreQuiz(quiz, hard).axes[0].score);
});

test("parseScore clamps, extracts embedded JSON, and rejects junk", () => {
  assert.equal(parseScore('{"relevant": true, "score": 2}', [-2, 2]), 2);
  assert.equal(parseScore('{"relevant": true, "score": 9}', [-2, 2]), 2);
  assert.equal(parseScore('{"relevant": true, "score": -7}', [-2, 2]), -2);
  assert.equal(parseScore('{"relevant": false, "score": 2}', [-2, 2]), 0);
  assert.equal(parseScore('The grade is {"relevant": true, "score": -1} as requested.', [-2, 2]), -1);
  assert.throws(() => parseScore("no json here", [-2, 2]));
  assert.throws(() => parseScore('{"relevant": true, "score": "high"}', [-2, 2]));
});

test("free response rubric detects configured themes", () => {
  const quiz = QUIZZES.find(q => q.id === "inner-narrator");
  const soft = { mistake: "It is okay; I learned something", proud: "I tried and grew", friend: "a", goal: "a" };
  const hard = { mistake: "I should do better, that was careless", proud: "I finished", friend: "d", goal: "d" };
  assert.ok(scoreQuiz(quiz, soft).axes[0].score < scoreQuiz(quiz, hard).axes[0].score);
});
