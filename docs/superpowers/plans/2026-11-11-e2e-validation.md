# Quick Polls E2E Validation Plan

> **For agentic workers:** Use subagent-driven development for implementation and independent review.

**Goal:** Validate Quick Polls' documented workflows, fix demonstrated defects, and submit and monitor a PR.

**Architecture:** Execute the shipped `plugin.js` through its public plugin registrations in real browsers. Supply a deterministic Buzz host fixture at the injected capability boundary; use real React rendering and browser form behavior. Assert independently specified messages, rendered tallies, and forbidden sends. No production test hooks.

**Tech Stack:** Playwright, React, esbuild, TypeScript, Node.js, GitHub Actions.

**Spec:** README.md and the vendored Buzz v1.0.0 author contracts.

## Global Constraints

- Node.js 20 or later; runtime bundle stays self-contained with no additional grants.
- Two to six distinct nonempty options; one counted choice per signing identity.
- Never post through an unavailable channel or stale identity/session.
- Edited polls do not inherit votes; unavailable deliveries do not display a tally.
- Host fixtures do not prove live relay delivery, installer behavior, or real desktop integration.

## Review Focus

- Membership, access, scope, viewer and session changes between opening and submission.
- Duplicate submits and queue failures followed by retry.
- Markdown-like and boundary-length input, whitespace and duplicate labels.
- Duplicate reaction events, keycap variants, custom emoji and multiple-choice voters.
- Malformed bodies, source versus rendered content, edited and nonordinary messages.

## Tasks

1. Audit host contracts independently. Identify concrete defects and check fixture assumptions.
2. Implement host fixture and browser suite loading the built artifact. Cover creation, delivery/tally updates, validation, eligibility and lifecycle. Pin test dependencies and wire CI. Run tests; report production defects before fixes.
3. Reproduce each defect with a failing regression, apply the smallest fix, rebuild the committed bundle and rerun relevant checks.
4. Independently review all changes. Run the complete browser suite and type/build validation. Document evidence and limitations.
5. Commit, push, open and link the PR. Monitor checks/reviews through the PR watcher and resolve actionable feedback.

## Decisions

- Proceed on a dedicated branch in the clean existing checkout. The user's request authorizes implementation, fixtures, fixes and PR creation.
- The existing README supplies the behavior specification; no new product features are planned.
- PR publication requires resolving the inaccessible configured remote; local validation proceeds independently.

## Execution record

- Independent host-contract audit found no API mismatch and identified the diff-message recognition edge case.
- Added 48 browser scenarios and six artifact/build tests, plus typechecked host fixtures and CI.
- Reproduced the diff-message defect in the shipped bundle and browser regression before adding the exclusion and rebuilding.
- Independent review found a registration-coverage gap. The fixture now opens from the registered menu label and renders tallies only for message-placement accessories.
- Parent validation passed all 96 Chromium/WebKit checks. The initial Playwright 1.58.2 Firefox binary failed before loading any plugin code on macOS 27.3; checking the current supported release before concluding an environment limitation.
- GitHub destination remains unresolved: authenticated account can access the organization, but the configured repository does not exist or is inaccessible. User clarification requested while local work continues.
- Updated the pinned Playwright version to 1.65.0 and reinstalled its browsers. Fresh `npm ci && npm test`: artifact 6/6, source/fixture/spec typechecks passed, Chromium 48/48 and WebKit 48/48 passed; Firefox 48/48 failed at browser launch before test execution (`Could not find profile folder`). Standalone launch with a different temporary directory reproduces the failure. No Firefox cases were skipped or weakened. Linux CI verification is still pending.
- Mutation checks independently confirmed the happy-path test fails for wrong accessory placement and a missing documented menu label; the original bundle was restored and the happy path/artifact checks rerun successfully.
