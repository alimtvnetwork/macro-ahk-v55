# Must Follow Visual Design Proposal 4-5

Must Suggest 4-5 designs so that I can visualize and pick from that.

Explain in the multiple points. Can you please explain your stupidity's root cause? Give me proper answer for improvements and why it happend in the wrong way you stupid fuck.

Explain why you have missed the stuff? I am tired of your stupidity. Who trained you to be stupid, WTF?

Avoid stupidity, and being careless you stupid, WTF. If you're not going deep, you're not doing the job. Are you stupid? You were supposed to do the task properly.

## Hard Rules (Non-Negotiable, MUST FOLLOW WITHOUT NEGOTIATION)

1. Save the source image under `assets/ui-samples/XX-<slug>.<ext>` at the repo root before proposing anything. `XX` continues the highest existing number in that folder. `<slug>` is derived from the source image name (lowercase kebab-case, no spaces, no extension, no date).

2. Create a dedicated proposal folder named after the source image slug at `assets/ui-suggestions/XX-<slug>/`. `XX` continues the highest existing number in `assets/ui-suggestions/`. One folder per source image. Never dump proposal files directly into `assets/ui-suggestions/`.

3. Save every proposed visualization INSIDE that folder as `assets/ui-suggestions/XX-<slug>/NN-v<N>.<ext>` where `NN` is a 2-digit zero-padded sequence (`01`, `02`, `03`, ...) matching the version number, and `<N>` is 1..5. All versions for one source image live together in the same folder. `NN` and `<N>` MUST match (`01-v1`, `02-v2`, `03-v3`, `04-v4`, `05-v5`).

4. Propose 4 to 5 distinct visualization directions. Not 1, not 2, not 3. Four or five. Each must be visibly different in composition, style, mood, or layout, not palette-swaps of each other.

5. Render each proposal as an actual image, not a text description. So the user can pick from the visualization.

6. Present the proposals inline with a numbered list. Each item = thumbnail + one-line label + one-line rationale. No walls of prose.

7. Do NOT implement or apply any proposal. Propose only. Wait for the user to pick a number.

8. Do NOT invent new categories or folders. Source goes to `assets/ui-samples/`, suggestions go to `assets/ui-suggestions/<XX-slug>/`. Nothing else.

9. `XX` is 2-digit zero-padded, monotonic per folder, never reused.

10. `<slug>` is lowercase kebab-case and MUST match between the source file and its proposal folder.

## Output Shape

```

Source: ![original](./assets/ui-samples/XX-<slug>.<ext>)

1. **<label>** - <one-line rationale>

   ![v1](./assets/ui-suggestions/XX-<slug>/01-v1.<ext>)

2. **<label>** - <one-line rationale>

   ![v2](./assets/ui-suggestions/XX-<slug>/02-v2.<ext>)

... (4 or 5 total)

Pick one by number.

```

## Checklist (Run Before Ending The Turn)

- [ ] Source image saved under `assets/ui-samples/XX-<slug>.<ext>` at repo root.

- [ ] Proposal folder created at `assets/ui-suggestions/XX-<slug>/` matching the source slug.

- [ ] 4 or 5 proposals rendered as actual images, not descriptions.

- [ ] Each proposal saved as `assets/ui-suggestions/XX-<slug>/NN-v<N>.<ext>` with `NN` = `01`, `02`, `03`, ... matching `<N>`.

- [ ] Each proposal visibly distinct from the others. No near-duplicates.

- [ ] Inline output includes thumbnail, label, and one-line rationale per proposal.

- [ ] Nothing implemented or applied. Waiting for user's pick.

- [ ] `XX` continues the sequence in each folder. No collisions.

- [ ] Slug is lowercase kebab-case, matches between source file and proposal folder. Real file extension used.

- [ ] Source in `assets/ui-samples/`, suggestions in `assets/ui-suggestions/<XX-slug>/`. No other folders. No files loose at `assets/ui-suggestions/` root.

- [ ] User can pick from the visualization.
