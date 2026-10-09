import { Body, Panel } from "@/ui/components";
import type { MapCanvasProps } from "./MapCanvas";
export default function MapCanvas({ point }: MapCanvasProps) {
  return (
    <Panel>
      <Body>The interactive native map is available on Android and iOS.</Body>
      <Body>
        Selected point: {point.latitude.toFixed(4)},{" "}
        {point.longitude.toFixed(4)}
      </Body>
    </Panel>
  );
}
