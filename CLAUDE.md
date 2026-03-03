# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TypeScript library for communicating with the Discourse forum API. Handles user lookup by email and group membership management, with built-in retry logic (exponential backoff on 429/503).

## Commands

- **Run all tests:** `npm test`
- **Run a single test file:** `npx jest --runInBand path/to/test.ts`
- **Install dependencies:** `npm install`

There is no build step, linter, or tsconfig — TypeScript compilation is handled implicitly by ts-jest.

## Architecture

- **Entry point:** `src/index.ts` — re-exports all public types and classes
- **`src/managers/DiscourseManager.ts`** — Main API client class. Constructor takes `baseURL`, `apiKey`, `apiUsername`. Uses native `fetch` with a hand-written retry helper (exponential backoff on 429/503). Two public methods: `addUserWithEmailToGroup` and `removeUserWithEmailFromGroup`, both resolve a user email to a forum username first, then update group membership.
- **`src/model/`** — TypeScript interfaces for Discourse data (e.g., `DiscourseUser`)
- **`src/webhooks/payloads/`** — TypeScript interfaces for Discourse webhook payloads

## Testing

- Framework: Jest + ts-jest
- Test files go in `tests/` and must match `*.test.ts` or `*.spec.ts`
- Tests run sequentially (`--runInBand`)
