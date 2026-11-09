# @tools/dev-tasks

Two mechanical chores, made into scripts so a small model can run them by
following a short brief: `pnpm shots` captures PR screenshots, and
`pnpm checks` runs the repo's checks and prints one report.

A script is not a convenience here, it is the reason the chores can be handed
to a small model at all. Every step the root CLAUDE.md lists for these
chores — hide the dev toolbar, check the webfont loaded, build the corpus
before the data tests, set `CI` so the corpus gate cannot skip — lives in the
code, where it cannot be forgotten. The model only picks a command and
reports what it printed.

Agents that run these are in `.claude/agents/`: `screenshotter` and
`checker`, both on Haiku.

## `pnpm shots`

```bash
pnpm shots capture <list.json> [--before <ref>] [--out <dir>]
pnpm shots publish <dir> --pr <N>
```

`capture` starts the app's dev server on a spare port (never 4321, which your
own dev server is probably using), captures every shot, and stops the server.
With `--before main` it first does the same from a temporary worktree of
`main`, so each shot has a before and an after. Output goes to
`.shots/<list name>/` as `<shot>-<mobile|desktop>-<before|after>.png`.

`publish` pushes those PNGs to an orphan `assets/pr-<N>` branch, built in a
throwaway directory as the root CLAUDE.md requires, and prints a before/after
markdown table for the PR body.

### The shot list

```json
{
  "app": "hebrew",
  "shots": [
    {
      "name": "flashcards-revealed",
      "path": "/flashcards",
      "expect": "Again",
      "steps": [{ "click": "button:has-text('Show answer')" }],
      "storage": { "hebrew-tools-flashcard-display-v1": { "showPartOfSpeech": true } },
      "viewports": ["mobile", "desktop"],
      "fullPage": false,
      "element": "main"
    }
  ]
}
```

| Field | Required | Meaning |
|---|---|---|
| `app` | yes | `greek` or `hebrew` |
| `name` | yes | File-name slug, unique in the list |
| `path` | yes | Route, starting with `/` |
| `expect` | yes | Text that must be visible before the capture |
| `steps` | no | Interactions that reach the state: `click`, `hover`, `fill` (+ `text`), `press`, `waitFor`, `scrollTo`. Selectors are Playwright selectors |
| `storage` | no | localStorage set before the page loads; objects are JSON-encoded |
| `viewports` | no | `mobile` (390px) and/or `desktop` (1280px); both by default |
| `fullPage` | no | Capture the whole scrolling page |
| `element` | no | Capture one element instead of the viewport |

### What stops a wrong screenshot

The script never picks a page itself, and a capture is refused, with nothing
written, when any of these fail:

- the list has no shots, or a shot has no `expect`;
- the server answers 4xx/5xx;
- the page title is not `… | <app>.tools`;
- a step's selector matches nothing;
- the `expect` text is not visible after the steps;
- a Hebrew or Greek character on the page has no loaded face of the app's
  script font covering it (the shot would show a fallback face). This is
  checked per character, not per family: Google Fonts serves Noto Sans as
  separate files for Latin, basic Greek and polytonic Greek, so the Latin
  file loading proves nothing about ἀρχῇ.

Before each capture it also waits for running CSS transitions to finish:
`reducedMotion` does not stop them, and the mobile drawer shot mid-slide
passed every check above until it did. A step or `expect` matches the first
*visible* element, never a hidden copy such as the closed drawer's nav links.

What it cannot check is whether `expect` was a good choice. "Flashcards"
proves you are on the flashcards page; it does not prove the card is flipped.
Choose text that only appears in the state you mean to show, and look at the
images before they go on a PR. (On hebrew.tools, "Flashcards" is both a home
page card and a drawer link, so it proves nothing about the drawer.)

## `pnpm checks`

```bash
pnpm checks                   # the data group (default)
pnpm checks ci                # what both CI workflows run
pnpm checks hebrew:vocab      # one check, plus what it needs
pnpm checks --list            # every check and group
```

Checks run one after another. A failure does not stop the run, but a check
whose prerequisite failed is skipped and says why. Each check's output goes to
`.checks/<timestamp>/<id>.log`, and the report, a table plus the last 40 lines
of each failure, is printed and saved beside the logs as `report.md`. The exit
code is 0 when everything passed, 1 when anything failed or was skipped, and 2
for a bad selection.

Two things it does that are easy to get wrong by hand:

- **`hebrew:tests` runs with `CI=1`.** Without it, `corpus.test.ts` is off and
  every corpus check skips silently when the corpus is missing. With it, a
  missing corpus fails, as it does in the workflow.
- **Checks that read the corpus need `hebrew:corpus`**, so selecting one builds
  the corpus first instead of failing on an absent file.

The list of checks is `src/check-list.ts`. When CI gains a step or an app gains
a `--check` script, add it there.

## Tests

`pnpm --filter @tools/dev-tasks test:run`. `capture.test.ts` drives a real
Chromium against a small local HTTP server, so every refusal above is tested in
a browser without starting Astro. The process and git glue (`dev-server.ts`,
`git.ts`, the two CLIs) is mostly not unit-tested; every decision it acts on
lives in a tested module. The exception is `identityArgs` in `git.ts`:
`publish` commits in a fresh `git init`, which sees no per-repository
identity, and `git.test.ts` reproduces that failure with real git.
