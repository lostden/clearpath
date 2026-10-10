import CoordinateMap from "./CoordinateMap";
import type { MapCanvasProps } from "./MapCanvas";
export default function MapCanvas(props: MapCanvasProps) {
  return <CoordinateMap {...props} />;
}
