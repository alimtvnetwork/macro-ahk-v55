# Question : Must Follow and non-negotiable

Why have you done this? Explain me in detail why have you done this? And what is wrong with it? Explain in the multiple points. Can you please explain your stupidity's root cause? Give me proper answer for improvements and why it happend in the wrong way you stupid fuck.

If UI and file is given then tell me what is wrong with it.

Explain why you have missed the stuff? I am tired of your stupidity. Who trained you to be stupid, WTF?

Avoid stupidity, and being careless you stupid, WTF. If you're not going deep, you're not doing the job. Are you stupid? You were supposed to do the task properly. Where is this, are you stupid fuck? Where? Tell me. Your stupidity is going on top of my head. I mean, where did you learn this stupidity? If I could find you, I could slap you.

Put the files or images to assets folder

## Hard Rules (Non-Negotiable, MUST FOLLOW WITHOUT NEGOTIATION)

1. Every user-provided binary or file goes under `assets/<category>/XX-<slug>.<ext>` at the repo root. NOT inside `.lovable/`.

2. Every attachment that belongs to an issue goes under `assets/issues/XX-<slug>.<ext>` at the repo root.

3. Every reported problem gets a markdown file at `assets/issues/XX-<slug>.md` at the repo root. The problem text lives in that file, not only in chat.

4. Every markdown file created for a problem or note MUST reference the related asset file(s) inline with a relative path and a one-line caption. No orphan markdown, no orphan assets.

5. `XX` is 2-digit zero-padded, monotonic per folder scope, continuing the highest existing number in that folder. Never reuse. Never renumber existing files.

6. `<slug>` is lowercase kebab-case, no spaces, no extension, no date.

7. `<ext>` is the real file extension (`.png`, `.jpg`, `.pdf`, `.txt`, `.log`, `.json`, etc.). Do NOT rename `.png` to `.md`.

8. Do NOT dump files at the root of `assets/`. A `<category>` subfolder is mandatory.

9. Do NOT invent parallel folders (`attachments/`, `uploads/`, `screenshots/`, `bugs/`, `problems/`). Use `assets/<category>/` only.

10. `mv`, never `cp`, when a file moves between categories. Never rename on move.

## Category Map (Canonical)

Pick the tightest fit. If none fits, log an ambiguity, do NOT invent a new category.

- `assets/ui/` - UI screenshots, mockups, design references.

- `assets/spec/` - reference material attached to a spec.

- `assets/plans/` - reference material attached to a plan.

- `assets/audits/` - reference material attached to an audit.

- `assets/release/` - release notes visuals, changelog images.

- `assets/issues/` - screenshots, logs, HAR files, and the issue markdown files themselves.

- `assets/misc/` - only when nothing else fits AND you have logged an ambiguity asking for the right category.

## Problem / Issue File Shape

Path: `assets/issues/XX-<slug>.md`

Every issue markdown MUST include the verbatim user-provided text in the `## Context` block and MUST reference every related asset in `## Evidence`.

```

# <short title>

## Question

Verbatim question or complaint from the user.

## Context

Verbatim paste from the user. Where it happened, what they were doing, what they expected.

## Evidence

- ![screenshot](./05-login-500.png) - login page after submit

- [server log](./06-login-500.log) - request id abc123

## Reproduction

Ordered steps.

## Status

open | in-progress | fixed | wont-fix

```

Status flips only when a fix explicitly closes it. Do NOT auto-close.

## Referencing Rules

Every consumer file (spec, plan, task, issue markdown) that uses an asset must include:

- Relative path from the consumer file to the asset.

- One-line caption describing what the reader is looking at.

Example inside a spec at `.lovable/spec/21-auth/03-login.md`:

```

![login error state](../../../assets/ui/07-login-error.png) - error banner after invalid password

```

No bare paths. No "see attached". No links to chat.

## Avoid the Stupidity (Documented Past Failures)

- Left user-attached PNGs unsaved, referenced them from memory, then lost them next turn.

- Dumped attachments at repo root or `.lovable/` root.

- Wrote the problem only in the chat reply, no `assets/issues/` file, so the next turn had no record.

- Created an issue markdown without linking the screenshot/log it belongs to.

- Reused an `XX` number that already existed and overwrote a file.

- Invented `attachments/`, `screenshots/`, `bugs/` because "it felt cleaner".

- Renamed `.png` to `.md` and pasted a base64 blob inside. Never do this.

- Referenced assets with absolute chat URLs that expire.

Every one of these is a turn-failure. Do not repeat.

## Ambiguity (Canonical Block, Do Not Modify)

If the category is unclear, the slug is unclear, or the file could belong to more than one consumer, STOP and log it. Do not guess.

- Path for new questions: `.lovable/ambiguous-questions/01-new-ambiguity/XX-<slug>.md`

- Path for resolved questions: `.lovable/ambiguous-questions/02-ambiguity-resolved/XX-<slug>.md`

- `XX` is 2-digit zero-padded, continuing the highest existing number across BOTH folders.

- Each file contains: `## Question`, `## Context`, `## Options` (if any), and once answered, `## Resolution`.

- On resolution, MOVE the file from `01-new-ambiguity/` to `02-ambiguity-resolved/` and append `## Resolution`. Do NOT copy. Do NOT leave the original behind.

## Checklist (Run Before Ending The Turn)

- [ ] Every user attachment saved under `assets/<category>/XX-<slug>.<ext>` at repo root.

- [ ] Every reported problem written to `assets/issues/XX-<slug>.md` at repo root.

- [ ] Issue markdown includes the verbatim user text in `## Context`.

- [ ] Issue markdown links every related asset in `## Evidence` with relative path and caption.

- [ ] Category chosen from the canonical map. Ambiguity logged if unclear.

- [ ] `XX` continues the sequence in its folder. No collisions. No rewrites.

- [ ] Slug is lowercase kebab-case, no spaces, no extension, no date.

- [ ] Real file extension used. No `.png` renamed to `.md`.

- [ ] Consumer files (spec, plan, task) reference the asset with relative path and caption.

- [ ] No files at repo root, `.lovable/` root, or `assets/` root.

- [ ] No invented folders.

- [ ] No em dashes. No SEO chatter. No softening.
