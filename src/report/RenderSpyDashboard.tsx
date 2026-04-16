import React, { useEffect, useMemo, useRef, useState } from "react";
import { clearReport, getReport, type ComponentStats } from "../core/detector";

export interface RenderSpyDashboardProps {
  defaultOpen?: boolean;
  defaultMinimized?: boolean;
}

type Position = {
  x: number | null;
  y: number | null;
};

type DragOffset = {
  x: number;
  y: number;
};

type Pointer = {
  x: number;
  y: number;
};

const PANEL_WIDTH = 320;
const BASE_FONT =
  "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
const MONOSPACE_FONT =
  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

export const RenderSpyDashboard: React.FC<RenderSpyDashboardProps> = ({
  defaultOpen = true,
  defaultMinimized = false,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(defaultOpen);
  const [isMinimized, setIsMinimized] = useState<boolean>(defaultMinimized);
  const [position, setPosition] = useState<Position>({ x: null, y: null });
  const [report, setReport] = useState<ComponentStats[]>(() => getReport());

  const isDraggingRef = useRef<boolean>(false);
  const hasDraggedRef = useRef<boolean>(false);
  const dragOffsetRef = useRef<DragOffset>({ x: 0, y: 0 });
  const dragStartRef = useRef<Pointer>({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement | null>(null);

  const refreshReport = (): void => {
    setReport(getReport());
  };

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      refreshReport();
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent): void => {
      if (!isDraggingRef.current) {
        return;
      }

      const movedX = Math.abs(event.clientX - dragStartRef.current.x);
      const movedY = Math.abs(event.clientY - dragStartRef.current.y);
      if (movedX > 3 || movedY > 3) {
        hasDraggedRef.current = true;
      }

      const nextX = event.clientX - dragOffsetRef.current.x;
      const nextY = event.clientY - dragOffsetRef.current.y;
      setPosition({ x: nextX, y: nextY });
    };

    const handleMouseUp = (): void => {
      isDraggingRef.current = false;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const beginDrag = (event: React.MouseEvent<HTMLDivElement>): void => {
    if (!panelRef.current) {
      return;
    }

    const rect = panelRef.current.getBoundingClientRect();
    dragOffsetRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    dragStartRef.current = { x: event.clientX, y: event.clientY };
    hasDraggedRef.current = false;
    isDraggingRef.current = true;

    // Switch from bottom-right anchor to absolute viewport coordinates.
    if (position.x === null || position.y === null) {
      setPosition({ x: rect.left, y: rect.top });
    }
  };

  const totalRenders = useMemo<number>(() => {
    return report.reduce((sum, item) => sum + item.renderCount, 0);
  }, [report]);

  if (!isOpen) {
    return null;
  }

  const rootStyle: React.CSSProperties = {
    position: "fixed",
    zIndex: 9999,
    color: "#ffffff",
    backgroundColor: "#1a1a1a",
    border: "1px solid #333",
    borderRadius: 10,
    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.35)",
    fontFamily: BASE_FONT,
    cursor: "grab",
    userSelect: "none",
    ...(position.x === null || position.y === null
      ? { right: 16, bottom: 16 }
      : { left: position.x, top: position.y }),
  };

  if (isMinimized) {
    return (
      <div
        ref={panelRef}
        style={{
          ...rootStyle,
          padding: "10px 14px",
          width: "auto",
          fontSize: 13,
          fontWeight: 600,
        }}
        onMouseDown={beginDrag}
        onClick={() => {
          if (!hasDraggedRef.current) {
            setIsMinimized(false);
          }
          hasDraggedRef.current = false;
        }}
        role="button"
        aria-label="Expand RenderSpy dashboard"
      >
        {`👁 ${totalRenders} renders`}
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      style={{
        ...rootStyle,
        width: PANEL_WIDTH,
        overflow: "hidden",
      }}
      onMouseDown={beginDrag}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px",
          borderBottom: "1px solid #333",
          backgroundColor: "#141414",
          fontWeight: 700,
          fontSize: 14,
        }}
      >
        <span>👁 renderspy</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={() => setIsMinimized(true)}
            style={{
              border: "1px solid #444",
              background: "#232323",
              color: "#fff",
              borderRadius: 4,
              padding: "2px 8px",
              cursor: "pointer",
            }}
            aria-label="Minimize dashboard"
          >
            −
          </button>
          <button
            type="button"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={() => setIsOpen(false)}
            style={{
              border: "1px solid #444",
              background: "#232323",
              color: "#fff",
              borderRadius: 4,
              padding: "2px 8px",
              cursor: "pointer",
            }}
            aria-label="Close dashboard"
          >
            ×
          </button>
        </div>
      </div>

      <div style={{ maxHeight: 260, overflowY: "auto" }}>
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
        >
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #333" }}>
              <th style={{ padding: "8px 10px" }}>Component</th>
              <th style={{ padding: "8px 10px", width: 70 }}>Renders</th>
              <th style={{ padding: "8px 10px", width: 60 }}>Wasted</th>
            </tr>
          </thead>
          <tbody>
            {report.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  style={{ padding: "12px 10px", color: "#b8b8b8" }}
                >
                  No render data yet.
                </td>
              </tr>
            ) : (
              report.map((item) => {
                let backgroundColor = "rgba(56, 161, 105, 0.18)";
                if (item.unnecessaryRenders > 2) {
                  backgroundColor = "rgba(220, 38, 38, 0.24)";
                } else if (item.unnecessaryRenders >= 1) {
                  backgroundColor = "rgba(245, 158, 11, 0.24)";
                }

                return (
                  <tr
                    key={item.componentName}
                    style={{
                      backgroundColor,
                      borderBottom: "1px solid #2a2a2a",
                    }}
                  >
                    <td
                      style={{
                        padding: "8px 10px",
                        fontFamily: MONOSPACE_FONT,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: 130,
                      }}
                      title={item.componentName}
                    >
                      {item.componentName}
                    </td>
                    <td style={{ padding: "8px 10px" }}>{item.renderCount}</td>
                    <td style={{ padding: "8px 10px", fontWeight: 700 }}>
                      {item.unnecessaryRenders}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 12px",
          borderTop: "1px solid #333",
          backgroundColor: "#141414",
        }}
      >
        <button
          type="button"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={() => {
            clearReport();
            refreshReport();
          }}
          style={{
            border: "1px solid #444",
            background: "#232323",
            color: "#fff",
            borderRadius: 6,
            padding: "5px 10px",
            cursor: "pointer",
          }}
        >
          Clear
        </button>
        <button
          type="button"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={refreshReport}
          style={{
            border: "1px solid #444",
            background: "#232323",
            color: "#fff",
            borderRadius: 6,
            padding: "5px 10px",
            cursor: "pointer",
          }}
        >
          Refresh
        </button>
      </div>
    </div>
  );
};
