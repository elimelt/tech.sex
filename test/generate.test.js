import test from "node:test";
import assert from "node:assert/strict";
import { questionCount, planBatches, parseQuestion, tryParseQuestion, makeObjectExtractor } from "../src/generate.js";

test("planBatches splits the quota into batches of at most 3", () => {
  assert.deepEqual(planBatches(4), [["choice", "choice", "choice"], ["text"]]);
  const nine = planBatches(9);
  assert.deepEqual(nine.map(b => b.length), [3, 3, 3]);
  assert.equal(nine.flat().filter(t => t === "text").length, 3);
  assert.equal(planBatches(10).flat().length, 10);
});

test("questionCount scales with document length within bounds", () => {
  assert.equal(questionCount("a few words"), 4);
  assert.equal(questionCount(Array(600).fill("word").join(" ")), 5);
  assert.equal(questionCount(Array(5000).fill("word").join(" ")), 10);
});

test("parseQuestion accepts canonical choice and text questions", () => {
  const choice = parseQuestion('{"type":"choice","prompt":"What is TCP?","options":["a","b","c","d"],"correct":2,"why":"because"}');
  assert.deepEqual(choice, { type: "choice", prompt: "What is TCP?", options: ["a", "b", "c", "d"], correct: 2, why: "because" });
  const text = parseQuestion('{"type":"text","prompt":"Explain backoff.","rubric":"mentions retries and jitter"}');
  assert.deepEqual(text, { type: "text", prompt: "Explain backoff.", rubric: "mentions retries and jitter" });
});

test("parseQuestion coerces common model deviations", () => {
  assert.equal(parseQuestion({ type: "choice", prompt: "x", options: ["a", "b", "c"], correct: "2" }).correct, 2);
  assert.equal(parseQuestion({ prompt: "x", options: ["cat", "dog"], answer: "Dog" }).correct, 1);
  assert.deepEqual(parseQuestion({ type: "choice", prompt: "x", options: [{ label: "a" }, { text: "b" }], correct_answer: "a" }).options, ["a", "b"]);
  assert.equal(parseQuestion({ prompt: "x", rubric: ["point one", "point two"] }).rubric, "point one; point two");
  assert.equal(parseQuestion({ prompt: "x", key_points: ["k1", "k2"] }).type, "text");
});

test("parseQuestion rejects the unsalvageable", () => {
  assert.throws(() => parseQuestion({ type: "choice", prompt: "x", options: ["only one"], correct: 0 }));
  assert.throws(() => parseQuestion({ type: "choice", prompt: "x", options: ["a", "b", "c", "d"], correct: 9 }));
  assert.throws(() => parseQuestion({ prompt: "x", options: ["a", "b"], answer: "z" }));
  assert.throws(() => parseQuestion({ type: "text", prompt: "x" }));
  assert.throws(() => parseQuestion({ type: "text", rubric: "r" }));
});

test("makeObjectExtractor pulls objects out of any surrounding format", () => {
  const collect = () => { const out = []; return [out, makeObjectExtractor(o => out.push(o))]; };
  // JSONL
  let [out, feed] = collect();
  feed('{"a":1}\n{"b":2}\n');
  assert.deepEqual(out, ['{"a":1}', '{"b":2}']);
  // array-wrapped, pretty-printed, delivered in tiny chunks
  [out, feed] = collect();
  for (const ch of '[\n  { "a": {"nested": 1} },\n  { "b": 2 }\n]') feed(ch);
  assert.deepEqual(out.map(o => JSON.parse(o).b ?? JSON.parse(o).a.nested), [1, 2]);
  // fenced with prose, braces inside strings
  [out, feed] = collect();
  feed('Here you go:\n```json\n{"prompt":"what does { mean?","x":"}"}\n```\ndone');
  assert.equal(JSON.parse(out[0]).prompt, "what does { mean?");
  // escaped quotes inside strings
  [out, feed] = collect();
  feed('{"s":"a \\" b }"}');
  assert.equal(JSON.parse(out[0]).s, 'a " b }');
});

test("tryParseQuestion returns null instead of throwing", () => {
  assert.equal(tryParseQuestion("not json"), null);
  assert.equal(tryParseQuestion('{"type":"choice","prompt":"x"}'), null);
  assert.ok(tryParseQuestion('{"type":"text","prompt":"x","rubric":"y"}'));
});
