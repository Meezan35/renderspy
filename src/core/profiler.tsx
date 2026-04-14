import React, {
  Children,
  Profiler,
  type ProfilerOnRenderCallback,
  isValidElement,
} from "react";
import { recordRender } from "./detector";

export interface RenderSpyProps {
  children: React.ReactNode;
  threshold?: number;
  onSlowRender?: (componentName: string, renderTime: number) => void;
  enabled?: boolean;
}

function getComponentName(type: React.ElementType): string {
  if (typeof type === "string") {
    return type;
  }

  if (typeof type === "function") {
    return type.displayName || type.name || "Anonymous";
  }

  if (typeof type === "object" && type !== null && "displayName" in type) {
    const value = (type as Record<string, unknown>).displayName;
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return "Anonymous";
}

function toPropSnapshot(props: unknown): Record<string, unknown> {
  if (props && typeof props === "object" && !Array.isArray(props)) {
    return props as Record<string, unknown>;
  }

  return {};
}

export const RenderSpy: React.FC<RenderSpyProps> = ({
  children,
  threshold = 16,
  onSlowRender,
  enabled = true,
}) => {
  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <>
      {Children.map(children, (child) => {
        if (!isValidElement(child)) {
          return child;
        }

        const componentName = getComponentName(child.type as React.ElementType);
        const handleRender: ProfilerOnRenderCallback = (
          id,
          phase,
          actualDuration,
        ) => {
          const currentProps = toPropSnapshot(child.props);
          recordRender(id, currentProps, actualDuration);

          if (phase === "update" && actualDuration > threshold) {
            onSlowRender?.(id, actualDuration);
          }
        };
        return (
          <Profiler id={componentName} onRender={handleRender}>
            {child}
          </Profiler>
        );
      })}
    </>
  );
};
