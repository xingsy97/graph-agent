# Contributing to Graph Agent

Thank you for helping improve Graph Agent. Keep changes focused, reviewable, and aligned with the project's experimental scope.

## Before you start

- Search existing issues and pull requests before proposing duplicate work.
- Use an issue to discuss substantial features, architecture changes, or behavior changes.
- Report vulnerabilities privately according to [SECURITY.md](SECURITY.md).
- Follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Local development

1. Fork and clone the repository.
2. Install Node.js 22.13+, pnpm 11+, and the GitHub Copilot CLI.
3. Run `pnpm install`.
4. Copy `.env.example` to `.env.local`.
5. Use `AGENT_RUNTIME=mock` if Copilot authentication is unavailable.
6. Create a branch from the repository's default branch.

## Change standards

- Follow the existing TypeScript, React, and CSS conventions.
- Keep domain rules in `packages/domain` and runtime or transport concerns in `apps/web`.
- Add or update tests for behavior changes and bug fixes.
- Update related documentation and examples.
- Do not commit credentials, generated output, or local environment files.
- Avoid unrelated refactors in the same pull request.

## Verification

Run the complete local check before submitting:

```bash
pnpm check
```

## Pull requests

Use a clear title and explain the problem, approach, user-visible impact, and verification performed. Link related issues and include screenshots or recordings for interface changes. Maintainers may request that large changes be split into smaller pull requests.

By contributing, you agree that your contribution is licensed under the MIT License.
