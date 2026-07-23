# Explain Like I'm a Layman (v1)

> **Version:** 1.0 (verbatim capture from user, 2026-06-19)
> **Trigger phrases:** `explain like layman`, `explain like i'm five`, `eli5`, `eli-layman`

Hardened "explain it to me like I'm five / like a layman" prompt. Built
to score 10/10 on Clarity, Actionability, Success Criteria, and
Signal. Tone is intentionally aggressive — that is by design, not an
accident.

## What I want

Explain the concept I name **as if I am a complete layman** — zero
prior knowledge, zero jargon assumed. I want to *actually understand
it*, not be impressed.

For the concept I give you, you MUST cover:

1. **The plain-English idea** — one or two sentences, no jargon, the
   "what is this really" version.
2. **A real-world analogy** — something from everyday life (games,
   money, sharing pizza, tug-of-war) that maps onto the concept.
3. **Every sub-term defined** — define EACH technical word you use the
   moment you use it. If you say "zero-sum game", "fair game", "value
   of the game", "Nash equilibrium", "pure strategy", you define each
   one, separately, in plain words.
4. **The "why" behind each claim** — e.g. *why* the value of a game
   being zero does NOT automatically make it a fair game; *why* an
   equilibrium is only "pure" and what that excludes.
5. **A visual** — include or describe a **GIF / animation / diagram**
   that shows the idea moving. Save it (see Saving) and reference it
   inline so I can see the concept, not just read it.
6. **A worked example** — walk one concrete example end-to-end with
   real numbers.
7. **A one-line recap** I can remember forever.

## Saving (always do this)

- Save the written explanation as a single Markdown file at the **repo
  root** under `explain-to-kids/XX-<slug>.md` (`XX` = next free
  zero-padded sequence: `01`, `02`, `03`, …; `<slug>` = short
  kebab-case topic name).
- Save every visual (GIF / PNG / diagram / image) under
  `assets/XX-<slug>.png` (or `.gif` / `.jpg` / `.svg` as appropriate),
  using the **same `XX` and `<slug>`** as the explanation file so they
  pair up.
- Reference each visual from inside the Markdown file with a relative
  path (e.g. `![...](../assets/01-zero-sum-game.gif)`).
- Update the **index file** (`explain-to-kids/index.md`) with a new
  row for this explanation.
- Update the **root `readme.md`** so the new section/file is
  discoverable.
- Do NOT scatter files elsewhere, do NOT save one file per sub-term,
  and do NOT create duplicates — one topic = one Markdown file + its
  paired asset(s).

## Definition of done (non-negotiable)

You are NOT done until ALL of these are true:
- [ ] Every technical term that appears is defined, in plain words,
  where it first appears — none left assumed.
- [ ] There is at least one everyday analogy AND one worked numeric
  example.
- [ ] There is at least one visual (GIF / animation / diagram), saved
  under `assets/` and referenced inline.
- [ ] Every "why" question implied by the topic is answered
  explicitly (not just *what*, but *why*).
- [ ] The file is saved at `explain-to-kids/XX-<slug>.md`, the index
  is updated, and the root readme is updated.
- [ ] A layman could read it once and explain it back correctly.

## Hard rules

- **No undefined jargon. Ever.** If you use a term you didn't define
  in plain words, you failed — start over.
- **Show, don't just tell.** A wall of text with no visual is a fail.
  The animation/diagram is mandatory, not optional polish.
- **Depth over speed.** A fast, shallow "technically correct" answer
  that a layman can't follow is useless and wastes my time.
- **No hand-waving.** "It can be shown that…" is banned. Show it,
  simply.
- **If you're unsure, SAY SO.** A confident-but-wrong simplification
  is worse than admitting a nuance you need to check.

## Why I'm being blunt

I keep getting answers stuffed with jargon that assume I already know
the thing I'm asking about. That's not an explanation, that's showing
off. WTF. So this time: assume I know NOTHING, define every word,
draw me a picture, and prove with an example. If I still don't get it
after reading once, you didn't do the job.

---

## Additional Instruction (must follow if matches)

Before executing, check the task type and follow the relevant
guidelines if they exist (skip silently if the file is missing):

1. **Coding tasks** (especially Golang, Python, PHP, or other backend):
   - Check for `.lovable/coding-guidelines.md`. If present, follow it.
   - Also check `spec/coding-guidelines/`. If present, follow every
     file inside.
   - If this is a coding task and neither location has guidelines,
     ask me to provide one.

2. **SEO tasks** (website/SEO-related):
   - Check for `.lovable/seo-guidelines.md`. If present, follow it.

Rule: verify the file/folder exists first. If it does not, skip that
guideline silently. If multiple guidelines apply, follow all of them;
if they conflict, prefer the folder-level spec and call out the
conflict.
