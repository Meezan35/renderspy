# renderspy

> Catch unnecessary re-renders before they catch you.

[![npm version](https://img.shields.io/npm/v/renderspy.svg)](https://www.npmjs.com/package/renderspy)
[![npm downloads](https://img.shields.io/npm/dm/renderspy.svg)](https://www.npmjs.com/package/renderspy)
[![license](https://img.shields.io/npm/l/renderspy.svg)](./LICENSE)
[![bundle size](https://img.shields.io/bundlephobia/minzip/renderspy)](https://bundlephobia.com/package/renderspy)

> [!WARNING]
> `renderspy` is intended for **development and profiling only**.
> Remove it from production builds or guard it with `process.env.NODE_ENV !== 'production'`.

<img width="1624" height="804" alt="renderspy dashboard" src="https://github.com/user-attachments/assets/bbc16141-fa48-4bf7-8097-65e992bd27c2" />

---

## Why renderspy?

React DevTools is powerful, but it requires opening a browser extension and manually hunting for hot components. `renderspy` is different — it lives inside your app, logs programmatically, and surfaces unnecessary re-renders with zero configuration.

- No browser extension needed
- Works in any environment (local, staging, CI)
- Log render reports programmatically via `getReport()`
- Ships with TypeScript types. Supports ESM and CJS.

---

## Install

```bash
npm install renderspy
# or
yarn add renderspy
# or
pnpm add renderspy
```

**Peer requirements:**

| Peer | Version |
|------|---------|
| `react` | `>=17.0.0` |
| `react-dom` | `>=17.0.0` |

> React 17+ is required because `renderspy` uses the [React Profiler API](https://react.dev/reference/react/Profiler) introduced in that release.

---

## Quick Start

```tsx
import { RenderSpy, RenderSpyDashboard } from "renderspy";

function App() {
  return (
    <>
      <RenderSpy threshold={16}>
        <YourApp />
      </RenderSpy>

      {/* Floating dashboard — remove before shipping to production */}
      <RenderSpyDashboard />
    </>
  );
}
```

Open your app. The floating panel appears in the corner showing live render counts, unnecessary renders, and timing per component.

---

## Core API

### `<RenderSpy>`

Wrap any part of your React tree to start collecting render metrics.

```tsx
type RenderSpyProps = {
  children: React.ReactNode;
  threshold?: number;          // ms before a render is flagged as slow (default: 16)
  onSlowRender?: (componentName: string, renderTime: number) => void;
  enabled?: boolean;           // default: true
};
```

**Behavior:**
- Records both `mount` and `update` renders
- Flags a render as "unnecessary" when every prop passes referential equality (`===`)
- Calls `onSlowRender` for `update` renders that exceed `threshold`

---

### `withRenderSpy(Component, options?)`

HOC form for tracking a single component without restructuring your tree.

```tsx
import { withRenderSpy } from "renderspy";

const TrackedUserCard = withRenderSpy(UserCard, { threshold: 8 });
const TrackedCounter  = withRenderSpy(Counter);
```

**Includes:**
- Ref forwarding
- Preserves original `displayName`
- Static property hoisting via `hoist-non-react-statics`

**Type signature:**

```tsx
function withRenderSpy<T extends object>(
  WrappedComponent: React.ComponentType<T>,
  options?: { threshold?: number }
): React.ForwardRefExoticComponent<
  React.PropsWithoutRef<T> & React.RefAttributes<unknown>
>;
```

---

### `<RenderSpyDashboard>`

A floating, draggable overlay that shows live render stats.

```tsx
type RenderSpyDashboardProps = {
  defaultOpen?: boolean;       // default: true
  defaultMinimized?: boolean;  // default: false
};
```

**Features:**
- Fixed, draggable panel — won't interfere with your layout
- Auto-refreshes every 1000ms
- Color-coded rows highlight components with wasted renders
- `Clear` and `Refresh` controls

---

### `getReport()`

Read all collected stats at any time. Useful for logging, assertions, or CI checks.

```tsx
import { getReport } from "renderspy";

const report = getReport();
// Returns ComponentStats[]
```

```tsx
type ComponentStats = {
  componentName: string;
  renderCount: number;
  unnecessaryRenders: number;
  totalTime: number;       // ms
  averageTime: number;     // ms
  lastRenderTime: number;  // ms
};
```

**Example — log report on demand:**

```tsx
import { RenderSpy, getReport } from "renderspy";

function Demo() {
  return (
    <>
      <RenderSpy>
        <App />
      </RenderSpy>
      <button onClick={() => console.table(getReport())}>
        Log render report
      </button>
    </>
  );
}
```

---

### `clearReport()`

Reset all collected metrics back to zero.

```tsx
import { clearReport } from "renderspy";

clearReport();
```

---

### `recordRender()` _(advanced)_

Low-level function used internally by `RenderSpy` and `withRenderSpy`. Exported for custom integrations if you need to track renders outside of the standard wrappers.

---

## All Exports

```ts
import {
  RenderSpy,
  withRenderSpy,
  RenderSpyDashboard,
  getReport,
  clearReport,
  recordRender,
} from "renderspy";
```

**Type-only imports:**

```ts
import type {
  ComponentStats,
  RenderSpyProps,
  RenderSpyDashboardProps,
} from "renderspy";
```

---

## How It Works

| What | How |
|------|-----|
| Render timing | React Profiler `actualDuration` |
| Unnecessary render detection | Prop-by-prop `===` comparison |
| Report sorting | By `unnecessaryRenders` descending |

---

## CI/CD Example (Render Regression Gate)

You can fail CI when critical components start introducing unnecessary renders.

### 1) Add an integration-style test

```tsx
// dashboard-render.test.tsx
import React from "react";
import { render } from "@testing-library/react";
import { RenderSpy, clearReport, getReport } from "renderspy";

type HeaderProps = { title: string };
const Header: React.FC<HeaderProps> = ({ title }) => <h1>{title}</h1>;

test("Header should keep unnecessary renders low", () => {
  clearReport();

  const { rerender } = render(
    <RenderSpy>
      <Header title="renderspy" />
    </RenderSpy>
  );

  // Same props on rerender should be tracked as unnecessary.
  rerender(
    <RenderSpy>
      <Header title="renderspy" />
    </RenderSpy>
  );

  const report = getReport();
  const header = report.find((item) => item.componentName === "Header");

  expect(header).toBeDefined();
  expect(header?.unnecessaryRenders).toBeLessThanOrEqual(1);
});
```

### 2) Run it in GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - run: npm test -- --runInBand
```

Tip: start with high-value components (layout, nav, large lists), then tighten limits over time.

---

## License

MIT © Meezan Shaikh