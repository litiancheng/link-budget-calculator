## Agent skills

### Issue tracker

Issues and specs are tracked as local Markdown files under `.scratch/<feature-slug>/`. See `docs/agents/issue-tracker.md`.

### Research reports

All research reports should be stored under `docs/research/`.

### Triage labels

The default triage vocabulary is used: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one root `CONTEXT.md` with ADRs under `docs/adr/`. See `docs/agents/domain.md`.

### Commit synchronization

- This repository uses `.githooks/post-commit` to push every local commit to GitHub after the commit is created, so pushes to `main` can trigger the GitHub Pages deployment workflow.
- After cloning the repository, enable the tracked hooks once with `git config --local core.hooksPath .githooks`. Before committing, verify that `git config --local --get core.hooksPath` returns `.githooks`.
- The hook pushes the current branch to its configured upstream. If the branch has no upstream, it pushes to `origin` and sets the upstream automatically. It never force-pushes and never stores credentials in the repository.
- If the push fails because of network, authentication, or remote state, keep the local commit, report the failure clearly, and retry with `git push` after the cause is fixed. Do not retry indefinitely and do not discard or rewrite the commit.
- When an agent creates a commit, it must confirm that the post-commit push ran successfully; if hooks are not enabled, configure `core.hooksPath` before committing or explicitly run the required push afterward.
