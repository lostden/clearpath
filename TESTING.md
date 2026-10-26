# ClearPath verification

Source version **1.1.0**. The submission cleanup changes documentation and a source comment; warning processing, screens, configuration, dependencies and test behavior are unchanged.

## Automated checks — October 25, 2026

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint -- --no-cache` | Passed |
| `npm test` | 46 suites / 924 tests passed |
| `node --test server/watcher.test.mjs` | 37 tests passed; external services mocked, temporary loopback HTTP listeners used |
| Browser export | Five static routes and a 1.5 MB web bundle exported successfully |

The app tests cover warning validity, updates and cancellations; deterministic display ordering; source/cache/demo separation; location and request lifecycle behavior; map and warning details; warning-to-guide navigation; and saved kit, plan and contact state.

## Repeat the checks

Use Node.js 22 and the committed npm lockfile:

```sh
npm ci --ignore-scripts
npm run typecheck
npm run lint
npm test
node --test server/watcher.test.mjs
```

For a browser bundle:

```sh
npx --no-install expo export --platform web
```

The watcher checks need permission to open temporary local loopback listeners. They do not activate cloud infrastructure or send real push notifications.

## Device evidence and limits

On October 14, Shiven reported four core physical iPhone checks passing: startup and tab navigation, the North Texas warning-to-Flooding-guide flow, map rendering/pan/zoom, and restoration of kit/meeting/contact values after reopening Expo Go with the development server available. These dated checks are not a complete current device-acceptance test.

Physical GPS/notification permissions and delivery, background behavior, full accessibility and keyboard coverage, and an installed-app offline cold restart remain unverified. Browser exports verify JavaScript bundling; they do not establish native compilation or phone behavior. No standalone 1.1.0 mobile binary is included.

Live feeds, map tiles and external links require connectivity. Cloud push remains inactive. Existing dependency findings and reviewed version limits are recorded in [DEPENDENCY_REVIEW.md](DEPENDENCY_REVIEW.md). Automated checks do not certify emergency delivery or personal safety.

[Project overview](README.md) · [Demo walkthrough](DEMO.md) · [Test source](tests/) · [Architecture](ARCHITECTURE.md)
