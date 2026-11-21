// End-to-end test: mock AI + mock search + mock web page, real server.js as a child process.
import http from "node:http"; import { spawn } from "node:child_process"; import assert from "node:assert/strict";
const MP = 4781; let searchCalls = 0;
const mock = http.createServer((q, r) => {
  let b = ""; q.on("data", d => b += d); q.on("end", () => {
    const j = o => { r.setHeader("content-type", "application/json"); r.end(JSON.stringify(o)); };
    if (q.url.startsWith("/res/v1/web/search")) { searchCalls++; return j({ web: { results: [
      { title: "Erneuerbare Energien", url: `http://127.0.0.1:${MP}/page`, description: "<strong>Quellen</strong> die sich erneuern" },
      { title: "Zweite Seite", url: "ftp://example.com/x", description: "ignored" }, { title: "Dritte", url: `http://127.0.0.1:${MP}/page2`, description: "s" }] } }); }
    if (q.url === "/page" || q.url === "/page2") { r.setHeader("content-type", "text/html"); return r.end("<html><body><nav>menu</nav><article>Erneuerbare Energien sind Sonne, Wind und Wasser.</article></body></html>"); }
    if (q.url === "/v1/messages") { const t = JSON.parse(b).messages[0].content, txt = o => j({ content: [{ type: "text", text: "Here: " + JSON.stringify(o) }] });
      if (t.includes("Decide whether")) return txt(t.includes("Wetter") ? { is_question: false, certainty: "none", question: "Heute ist das Wetter schön." } : { is_question: true, certainty: "certain", question: "Was sind erneuerbare Energien?", language: "German", subject: "Erdkunde", keywords: ["Energie"], queries: ["erneuerbare Energien Definition"] });
      return txt({ short_school: "Erneuerbare Energien erneuern sich natürlich.", de: "de", en: "en", ar: "ar", detailed: "d", supported: [{ text: "Sonne, Wind, Wasser", source_ids: [1] }, { text: "invented cite", source_ids: [99] }], ai_only: ["Allgemeinwissen"], confidence: "high", notes: "" }); }
    r.statusCode = 404; r.end();
  });
}).listen(MP);
const base = { ...process.env, ANTHROPIC_API_KEY: "k", BRAVE_API_KEY: "k", ANTHROPIC_BASE_URL: `http://127.0.0.1:${MP}`, BRAVE_BASE_URL: `http://127.0.0.1:${MP}`, ACCESS_CODE: "abc" };
const start = (port, env) => new Promise(res => { const p = spawn("node", ["server.js"], { env: { ...base, PORT: port, ...env } }); p.stdout.on("data", () => res(p)); });
const post = async (port, path, body, code = "abc") => { const r = await fetch(`http://127.0.0.1:${port}${path}`, { method: "POST", headers: { "content-type": "application/json", "x-access-code": code }, body: JSON.stringify(body) }); return { s: r.status, t: await r.text() }; };
const research = async (port, segment) => { const r = await post(port, "/api/research", { segment }); return { steps: r.t.trim().split("\n").map(JSON.parse) }; };
let n = 0; const ok = (name, f) => { f(); console.log("✓", name); n++; };
const s1 = await start(4782, {});
try {
  ok("access code enforced", () => {}); assert.equal((await post(4782, "/api/ai", { input: "x" }, "wrong")).s, 401);
  let r = await research(4782, "Heute ist das Wetter schön."); const before = searchCalls;
  ok("ordinary sentence triggers NO search", () => { assert.equal(before, 0); assert.equal(r.steps.at(-1).result.is_question, false); });
  r = await research(4782, "Was sind erneuerbare Energien?"); const res = r.steps.at(-1).result;
  ok("progress steps streamed", () => assert.deepEqual(r.steps.filter(s => s.step).map(s => s.step), ["detect", "search", "read", "answer"]));
  ok("only real http(s) sources returned, snippets stripped", () => { assert.equal(res.sources.length, 2); assert.ok(!res.sources[0].snippet.includes("<")); });
  ok("localhost pages NOT fetched (SSRF block)", () => assert.ok(res.sources.every(s => !s.read)));
  ok("invented citation [99] dropped and demoted to AI-only", () => { assert.deepEqual(res.supported[0].source_ids, [1]); assert.ok(res.ai_only.includes("invented cite")); });
  ok("answers in DE/EN/AR + short school answer", () => assert.ok(res.answer.short_school && res.answer.de && res.answer.en && res.answer.ar));
  const c = searchCalls; r = await research(4782, "  was sind  erneuerbare energien? ");
  ok("repeat question served from cache, no new search", () => { assert.equal(r.steps.at(-1).result.cached, true); assert.equal(searchCalls, c); });
  ok("/api/ai proxy works", () => {}); assert.equal((await post(4782, "/api/ai", { input: "hi" })).s, 200);
  ok("audio fallback reports missing key", () => {}); assert.equal((await post(4782, "/api/transcribe", {})).s, 501);
} finally { s1.kill(); }
const s2 = await start(4783, { ALLOW_PRIVATE_FETCH: "1" });
try { const r = await research(4783, "Was sind erneuerbare Energien?");
  ok("page text retrieved when fetching allowed (test flag)", () => assert.equal(r.steps.at(-1).result.sources[0].read, true)); } finally { s2.kill(); }
const s3 = await start(4784, { BRAVE_API_KEY: "" });
try { const r = await research(4784, "Was ist Fotosynthese?"); ok("missing search key gives setup error, no fake results", () => assert.match(r.steps.at(-1).error, /BRAVE_API_KEY/)); } finally { s3.kill(); }
console.log(`\nAll ${n} checks passed.`); mock.close(); process.exit(0);
