import type { KeyboardEvent } from "react";
import type { CoordinateAreaProps, CoordinateHitRectProps } from "./CoordinateTargets.types";

function activationProps(onActivate?: () => void) {
  if (!onActivate) return {};
  return {
    role: "button",
    tabIndex: 0,
    onClick: () => onActivate(),
    onKeyDown: (event: KeyboardEvent<SVGElement>) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      if (!event.repeat) onActivate();
    },
  };
}

// Only DOM SVG attributes reach these elements. The library's web onPress
// adapter emits native responder props and can replace DOM click handlers.
export function CoordinateArea({
  testID, label, onActivate, d, fill, stroke, strokeWidth,
}: CoordinateAreaProps) {
  return <path
    data-testid={testID} aria-label={label} d={d} fill={fill}
    stroke={stroke} strokeWidth={strokeWidth} fillRule="evenodd" clipRule="evenodd"
    {...activationProps(onActivate)}
  />;
}

export function CoordinateHitRect({
  testID, label, onActivate, x, y, width, height,
}: CoordinateHitRectProps) {
  return <rect
    data-testid={testID} aria-label={label} x={x} y={y} width={width} height={height}
    fill="transparent" {...activationProps(onActivate)}
  />;
}
