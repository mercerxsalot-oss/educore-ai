# EduCore AI 3.0

Your existing EduCore AI interface (all features kept) plus a Node.js backend that does **real web research**:
detected question → AI cleans it → search API → pages downloaded and text extracted → AI writes a DE/EN/AR answer from those pages → clickable sources.

## Install
```bash
npm install
cp .env.example .env     # then fill in the keys
npm start                # http://localhost:3000
npm test                 # end-to-end test with mock AI/search servers (no keys needed)
```
Requires Node.js 20+.

## API keys (server only, never sent to the browser)
| Variable | What / where |
|---|---|
| `ANTHROPIC_API_KEY` | AI answers. console.anthropic.com. `AI_MODEL` defaults to `claude-sonnet-5-5`. |
| `SEARCH_PROVIDER` | `brave` (default) or `google` |
| `BRAVE_API_KEY` | api.search.brave.com, create a "Search" subscription and copy the token |
| `GOOGLE_API_KEY` + `GOOGLE_CX` | Google Cloud: enable "Custom Search API", create a key; programmablesearchengine.google.com: create an engine ("search the entire web") and copy its ID (cx). Free tier is limited per day. |
| `OPENAI_API_KEY` | Optional. Whisper speech-to-text fallback for browsers without Web Speech (Firefox). |
| `ACCESS_CODE` | Strongly recommended when public: callers must send it, otherwise anyone can spend your API credit. |
| `SEARCH_COUNT`, `CACHE_TTL_MIN`, `RATE_LIMIT` | Results per search (5), cache lifetime (60 min), requests/min/IP (40) |

If a key is missing the app shows an error naming it. It never fakes a search or an answer.

## How it works
- **Classroom Live** transcribes with the browser's speech recognition (choose Deutsch / English / العربية first). Finished sentences are filtered locally; only likely questions go to `POST /api/research`.
- The server asks the AI whether it is a **genuine question**. If not, **no search happens**. Otherwise it runs 1-2 searches, reads up to 4 pages (redirects and private/internal addresses are blocked), and asks the AI to answer using only those sources.
- Results show source number, title, URL and whether the page text or only the snippet was read. Statements are split into **supported by sources** (with `[n]`) and **AI explanation, not backed by a source**. Citations the AI makes up are removed by the server.
- Searches and finished answers are cached in memory. Errors show a Retry button; a progress line shows detect, search, read, answer.
- Chat, homework, translator, study mode all call `/api/ai` through a small adapter in `public/index.html`, so they work unchanged outside the artifact.

## Speech-to-text and privacy
- Chrome, Edge, Safari: Web Speech API. **The browser vendor processes the audio** (in Chrome, on Google servers). For strict GDPR settings tell users, or use the Whisper fallback and update your privacy notice.
- Fallback (no Web Speech): the browser records 7-second clips and sends them to `/api/transcribe`; the server forwards them to OpenAI Whisper in memory and stores nothing.
- Kept from before: consent checkbox, red recording indicator, pause/stop, no audio stored, optional note saving, export/delete. Notes live in the browser's localStorage only.
- Microphone access needs **HTTPS** (localhost is exempt).

## Using index.html on its own
`public/index.html` is the whole frontend in one file. Host it anywhere (GitHub Pages, Netlify, or open it from the backend), then enter your backend address under Settings, Backend URL, and set `ALLOWED_ORIGIN=https://your-page-domain` in the backend `.env`. The backend itself cannot be inside an HTML file: it holds the secret keys.

## Deployment
Any Node host works (Render, Railway, Fly.io, a VPS). Set the environment variables in the host's dashboard (not in git), start command `npm start`, put it behind HTTPS, and set `ACCESS_CODE`. Behind a proxy add `app.set("trust proxy",1)` so rate limiting sees real IPs. In-memory cache and rate limits reset on restart; use Redis if you run several instances.

## What cannot live in the Claude artifact
Search API keys, page downloading (blocked by the artifact sandbox), and the grounded answer pipeline all run in `server.js`. The artifact version keeps only the AI-estimate mode without web search.
Not included: user accounts and a database (notes are per-browser), PDF upload parsing, OpenAI-based answers (the AI call is in `llm()` in `server.js` if you want to swap it).
