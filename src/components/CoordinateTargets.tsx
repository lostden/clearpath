import type { ReactNode } from "react";
import { G, Path, Rect } from "react-native-svg";
import type { CoordinateAreaProps, CoordinateHitRectProps } from "./CoordinateTargets.types";

export type CoordinateAreaGroupProps = Pick<CoordinateAreaProps, "testID" | "label" | "onActivate"> & {
  children: ReactNode;
};

/** One warning action; children retain independent fills and holes. */
export function CoordinateAreaGroup({ testID, label, onActivate, children }: CoordinateAreaGroupProps) {
  return <G testID={testID} onPress={onActivate} accessible={!!onActivate} accessibilityLabel={label}>
    {children}
  </G>;
}

/** Native SVG touch targets retain the original warning or observation callback. */
export function CoordinateArea({
  testID, label, onActivate, d, fill, stroke, strokeWidth,
}: CoordinateAreaProps) {
  return <Path
    testID={testID} d={d} fill={fill} stroke={stroke} strokeWidth={strokeWidth}
    fillRule="evenodd" clipRule="evenodd" onPress={onActivate}
    accessible={!!onActivate} accessibilityLabel={label}
  />;
}

export function CoordinateHitRect({
  testID, label, onActivate, x, y, width, height,
}: CoordinateHitRectProps) {
  return <Rect
    testID={testID} x={x} y={y} width={width} height={height} fill="transparent"
    onPress={onActivate} accessible={!!onActivate}
    accessibilityLabel={label}
  />;
}
