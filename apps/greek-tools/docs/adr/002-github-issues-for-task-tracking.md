# ADR 002: Use GitHub Issues for Task Tracking

## Status

Accepted

## Date

2026-04-06

## Context

Feature specs were previously maintained as Product Requirements Documents (PRDs) in `docs/prd/`. This worked well for capturing spec detail but had several drawbacks:

- No status tracking — no way to see at a glance what was open, in progress, or closed
- No linkage between a spec and the PR that implements it
- PRDs went stale as features shipped; keeping them in sync required manual discipline
- Two artifacts to maintain (PRD + PR) where one would suffice

The project uses GitHub for version control and pull requests. AI coding agents (Claude Code) have direct access to `gh` CLI, making GitHub Issues a natural integration point — agents can read issues, reference them in commits, and close them automatically when PRs merge.

Research into how other teams manage work with AI agents confirmed that GitHub Issues is the dominant pattern. GitHub Copilot's coding agent runs directly off issues; the community CCPM project uses issues + git worktrees for parallel agent task streams.

## Decision

Replace PRDs in `docs/prd/` with GitHub Issues. Each issue contains the full feature spec — background, goals, features, acceptance criteria, technical notes, and open questions — using a standard Markdown template stored at `.github/ISSUE_TEMPLATE/feature.md`.

All active PRDs were migrated to issues (#40–#71) with priority and size labels. The `docs/prd/` directory was removed.

## Consequences

- **Issues are the single artifact.** A `closes #N` reference in a PR description automatically closes the issue on merge, linking spec to implementation.
- **No more `docs/prd/` directory.** Spec history is preserved in git log and in the GitHub issue timeline.
- **Issue template enforces consistent structure** for future features.
- **Tradeoff:** Issues are not in the repo, so the spec doesn't travel with the code in git history. This is acceptable — GitHub preserves issues indefinitely and they remain searchable.
