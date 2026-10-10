type TargetProps = {
  testID: string;
  label: string;
  /** Omit for static and compact plots. */
  onActivate?: () => void;
};

export type CoordinateAreaProps = TargetProps & {
  d: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
};

export type CoordinateHitRectProps = TargetProps & {
  x: number;
  y: number;
  width: number;
  height: number;
};
