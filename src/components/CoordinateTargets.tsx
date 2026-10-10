import { Path, Rect } from "react-native-svg";
import type { CoordinateAreaProps, CoordinateHitRectProps } from "./CoordinateTargets.types";

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
