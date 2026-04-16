import React, { Profiler, useRef, type ProfilerOnRenderCallback } from "react";
import hoistNonReactStatics, {
  type NonReactStatics,
} from "hoist-non-react-statics";
import { recordRender } from "./detector";

const FORWARD_REF_SYMBOL = Symbol.for("react.forward_ref");

function getComponentName<T extends object>(
  WrappedComponent: React.ComponentType<T>,
): string {
  return WrappedComponent.displayName || WrappedComponent.name || "Anonymous";
}

function toPropSnapshot<T extends object>(props: T): Record<string, unknown> {
  return props as unknown as Record<string, unknown>;
}

function canAcceptRef<T extends object>(
  WrappedComponent: React.ComponentType<T>,
): boolean {
  const candidate = WrappedComponent as unknown as {
    prototype?: { isReactComponent?: unknown };
    $$typeof?: symbol;
  };

  const isClassComponent = Boolean(
    candidate.prototype &&
      typeof candidate.prototype === "object" &&
      "isReactComponent" in candidate.prototype,
  );

  const isForwardRefComponent = candidate.$$typeof === FORWARD_REF_SYMBOL;

  return isClassComponent || isForwardRefComponent;
}

export function withRenderSpy<T extends object>(
  WrappedComponent: React.ComponentType<T>,
  options?: { threshold?: number },
): React.ForwardRefExoticComponent<
  React.PropsWithoutRef<T> & React.RefAttributes<unknown>
> {
  const threshold = options?.threshold ?? 16;
  const componentName = getComponentName(WrappedComponent);

  const WithRenderSpy = React.forwardRef<unknown, T>((props, ref) => {
    const propsRef = useRef<Record<string, unknown>>(toPropSnapshot(props));
    propsRef.current = toPropSnapshot(props);

    const onRender: ProfilerOnRenderCallback = (
      id,
      phase,
      actualDuration,
    ) => {
      recordRender(id, propsRef.current, actualDuration);

      if (phase === "update" && actualDuration > threshold) {
        // eslint-disable-next-line no-console
        console.warn(
          `[renderspy] Slow render in ${componentName}: ${actualDuration.toFixed(2)}ms`,
        );
      }
    };

    if (canAcceptRef(WrappedComponent)) {
      const RefCompatibleComponent =
        WrappedComponent as unknown as React.ComponentType<
          T & React.RefAttributes<unknown>
        >;
      return (
        <Profiler id={componentName} onRender={onRender}>
          {React.createElement(RefCompatibleComponent, {
            ...(props as T),
            ref,
          })}
        </Profiler>
      );
    }

    return (
      <Profiler id={componentName} onRender={onRender}>
        {React.createElement(WrappedComponent as React.ComponentType<T>, props as T)}
      </Profiler>
    );
  });

  WithRenderSpy.displayName = componentName;

  const wrappedWithStatics = hoistNonReactStatics(
    WithRenderSpy,
    WrappedComponent,
  ) as React.ForwardRefExoticComponent<
    React.PropsWithoutRef<T> & React.RefAttributes<unknown>
  > &
    NonReactStatics<typeof WrappedComponent>;

  return wrappedWithStatics;
}
