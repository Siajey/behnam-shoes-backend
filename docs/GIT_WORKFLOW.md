# GIT_WORKFLOW.md — Git, Branches and Commits (Backend)

## General rules
- `main` is always healthy and deployable. **Never commit directly to `main`** (single exception: the very first commit).
- Every task = one short-lived branch = one Pull Request.
- Model: **GitHub Flow**. No `develop` branch; it only adds complexity for a small team.
- Package manager is ☐ open (D-018). Commands below use `npm`; swap if `pnpm` is chosen.

## 1. Day one (once)
```bash
git clone <backend-repo-url>
cd <repo-name>

# scaffold the project (NestJS CLI, Fastify adapter added afterwards)
npx @nestjs/cli new . --package-manager npm --strict

npm run start:dev          # should boot locally
git add .
git commit -m "chore: initialize NestJS project"
git push origin main
```

Then in GitHub (Settings → Branches → Add rule for `main`):
- Require a pull request before merging
- Require status checks to pass (once CI exists)
- Block force pushes
- (Optional) Require 1 approval

## 2. Branch names
`<type>/<short-english-description>`

| Type       | Use                                   | Example                          |
|------------|---------------------------------------|----------------------------------|
| `feat`     | New feature or endpoint               | `feat/auth-google-oauth`         |
| `fix`      | Bug fix                               | `fix/session-expiry-check`       |
| `chore`    | Tooling, config, dependencies, Docker | `chore/add-docker-compose`       |
| `docs`     | Documentation                         | `docs/add-decision-d021`         |
| `refactor` | Restructure without behavior change   | `refactor/split-user-repository` |
| `test`     | Tests                                 | `test/auth-e2e`                  |
| `db`       | Schema changes and migrations         | `db/add-blog-posts-table`        |

## 3. Commits
**Format (Conventional Commits):** `type(scope): short imperative description`

```
feat(auth): add google oauth callback
fix(sessions): reject expired session cookie
db(users): add deleted_at column
chore: add prettier and eslint rules
docs: record decision D-021
```

**When to commit:** each time one complete, working piece is done ("repository + E2E test for create user"), not "end of day" and not "every line". If you might want to revert just that piece, it deserves its own commit.

**Before committing:** `npm run lint`, `npx tsc --noEmit`, and the tests must pass. Husky can automate this later.

**Never commit:** `.env` (only `.env.example` without values), keys, secrets, `node_modules`, `dist`.

## 4. Task cycle
```bash
git switch main
git pull origin main
git switch -c feat/auth-google-oauth

# ... work + several small commits ...
git push -u origin feat/auth-google-oauth

# GitHub: open PR to main
# After review and green CI: Squash and merge, delete the branch
git switch main && git pull origin main
git branch -d feat/auth-google-oauth
```
If `main` moves ahead while you work:
```bash
git fetch origin
git rebase origin/main      # or git merge origin/main if you prefer
```

## 5. When to create a new branch
- **Always** before starting a task: a feature, an endpoint, a bug fix, a migration, a tooling change.
- Split large work into small branches (`feat/users-module`, `feat/auth-login`, `feat/auth-google`). Aim for PRs of tens to a few hundred lines, not thousands.
- Tiny doc fixes can be batched, but still go through a small PR.

## 6. Pull Requests
- Title like a commit: `feat(auth): add google oauth callback`
- Body:
  ```
  ## What changed
  ## API changes (new/changed/removed endpoints; breaking?)
  ## Migrations (yes/no, reversible?)
  ## How to test
  ## New decision? (if yes, D-0XX recorded)
  ```
- Read your own diff before sending, especially AI-generated code.
- Merge strategy: **Squash and merge**.
- CI (proposed): lint, type-check, E2E tests, Docker image build.

## 7. Database migrations
- Generate with Drizzle Kit (`drizzle-kit generate`), review the SQL, commit it together with the schema change in the same PR.
- **Never edit a migration that was already applied** anywhere shared; add a new one.
- Destructive changes (drop column/table) need a note in the PR and a plan for data.
- Keep schema changes backward compatible with the currently deployed frontend whenever possible.

## 8. Working with the frontend repo
- Repos are separate; **no shared PRs**.
- API change flow: update the code and Swagger in the backend PR, describe the change in the PR ("API changes"), then tell the frontend developer so they run their type generation (`api:gen`).
- Prefer additive changes. Breaking changes: new API version (D-013), announce first, and record in `DECISIONS.md`.

## 9. Releases (later)
- After the first real release: tag `v0.1.0`, then `v0.2.0`, etc. (`git tag v0.1.0 && git push --tags`).
- Production deploys come from `main`; the Docker image is tagged with the version or commit SHA.

## 10. When something goes wrong
| Situation                             | Fix                                                                          |
|---------------------------------------|------------------------------------------------------------------------------|
| Wrong commit, not pushed              | `git reset --soft HEAD~1`                                                    |
| Wrong file staged                     | `git restore --staged <file>`                                                |
| Half-done work, need to switch branch | `git stash`, then `git stash pop`                                            |
| A secret or key was committed         | **Revoke and rotate it immediately**; removing it from history is not enough |
| Bad migration already merged          | Add a new corrective migration; do not rewrite history                       |

## 11. Daily routine
1. `git switch main && git pull`, read latest `DECISIONS.md` changes.
2. Create a branch for today's task.
3. Several small commits.
4. End of day: push (the branch on GitHub is your backup) and open a PR when ready.
5. New decision made? Record it in `DECISIONS.md`.