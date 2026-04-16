export interface ComponentStats {
  componentName: string;
  renderCount: number;
  unnecessaryRenders: number;
  totalTime: number;
  averageTime: number;
  lastRenderTime: number;
}

/**
 * Snapshot of a component's props at a given render.
 * Keys are prop names, values are whatever was passed in.
 */
type PropSnapshot = Record<string, unknown>;

/**
 * Internal record stored per component instance.
 */
interface ComponentRecord {
  stats: ComponentStats;
  lastProps: PropSnapshot | null;
}

/**
 * A stable key that identifies a component across renders.
 * We use the display name provided by React Profiler.
 */
const registry = new Map<string, ComponentRecord>();

/**
 * Compare two prop snapshots using referential equality (===),
 * matching the same behaviour as React.memo.
 *
 * Returns true when every key/value pair is identical — meaning
 * the component rendered with props that haven't changed, i.e. the
 * render was unnecessary from a data perspective.
 */
function propsAreEqual(prev: PropSnapshot, next: PropSnapshot): boolean {
  const prevKeys = Object.keys(prev);
  const nextKeys = Object.keys(next);

  if (prevKeys.length !== nextKeys.length) {
    return false;
  }

  for (const key of prevKeys) {
    if (prev[key] !== next[key]) {
      return false;
    }
  }

  return true;
}

/**
 * Called after each render with the component name, its current props,
 * and the duration of that render phase (in ms, sourced from Profiler).
 *
 * - Increments renderCount unconditionally.
 * - Increments unnecessaryRenders when the previous props snapshot is
 *   identical to the current one (referential equality on every key).
 * - Accumulates timing data so averageTime can be derived on read.
 */
export function recordRender(
  componentName: string,
  currentProps: PropSnapshot,
  renderTime: number
): void {
  let record = registry.get(componentName);

  if (!record) {
    record = {
      stats: {
        componentName,
        renderCount: 0,
        unnecessaryRenders: 0,
        totalTime: 0,
        averageTime: 0,
        lastRenderTime: 0,
      },
      lastProps: null,
    };
    registry.set(componentName, record);
  }

  const { stats } = record;

  stats.renderCount += 1;
  stats.totalTime += renderTime;
  stats.lastRenderTime = renderTime;


  if (record.lastProps !== null && propsAreEqual(record.lastProps, currentProps)) {
    stats.unnecessaryRenders += 1;
  }

  // Store a shallow copy so mutations to the original object don't
  // retroactively change what we stored.
  record.lastProps = { ...currentProps };
}

/**
 * Returns a snapshot of all collected stats, sorted by unnecessary
 * render count descending so the worst offenders appear first.
 */
export function getReport(): ComponentStats[] {
  return Array.from(registry.values())
  .map((record) => ({
  ...record.stats,
  averageTime: Math.round((record.stats.totalTime / record.stats.renderCount) * 100) / 100
}))
    .sort((a, b) => b.unnecessaryRenders - a.unnecessaryRenders);
}

/**
 * Wipes all collected data. Useful between test runs or page navigations.
 */
export function clearReport(): void {
  registry.clear();
}
