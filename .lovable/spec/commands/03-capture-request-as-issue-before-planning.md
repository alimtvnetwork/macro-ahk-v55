Slug: capture-request-as-issue-before-planning
Status: active
Created: 2026-07-20

# Command: Capture the user's spoken request as an issue file BEFORE writing the plan

Scope: every planning turn.
Applies when: the user reports symptoms, asks for changes, or lists problems in the same message that asks for a plan.

## Rule

Before producing any plan file:

1. Copy the user's request into `.lovable/issues/open/XX-<slug>.md` verbatim (quoted), with expected vs actual and DoD.
2. Only THEN write the plan. The plan's Context section must link to every issue file created this turn.
3. Do not paraphrase away specifics like "there should be a More dropdown after 50" or "light mode looks broken" — quote them.

## Rationale

User stated (2026-07-18): "the first thing is that the request that I'm making, what you should do is put these files into the issues folder, mention it explicitly what I'm saying, and then you start with the task. You write what I'm saying right now into the empty file as an issue, and then you figure out the task what you have to complete in order to achieve it."
