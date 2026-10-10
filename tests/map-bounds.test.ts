import { fitMapGeometries, geometryIntersectsRegion, pointInRegion, type MapRegion } from "../src/domain/mapBounds";
import type { AlertGeometry, GeoPosition } from "../src/domain/types";

const view: MapRegion = { latitude: 30, longitude: -99, latitudeDelta: 2, longitudeDelta: 2 };
function polygon(ring: GeoPosition[]): AlertGeometry {
  return { type: "Polygon", coordinates: [ring] };
}

test("point culling includes exact viewport boundaries and excludes points beyond them", () => {
  expect(pointInRegion({ latitude: 31, longitude: -98 }, view)).toBe(true);
  expect(pointInRegion({ latitude: 29, longitude: -100 }, view)).toBe(true);
  expect(pointInRegion({ latitude: 31.000001, longitude: -99 }, view)).toBe(false);
  expect(pointInRegion({ latitude: 30, longitude: -100.000001 }, view)).toBe(false);
});

test("dateline views retain both sides of the antimeridian and equivalent longitude endpoints", () => {
  const dateline = { ...view, longitude: 180, longitudeDelta: 4 };
  expect(pointInRegion({ latitude: 30, longitude: 179 }, dateline)).toBe(true);
  expect(pointInRegion({ latitude: 30, longitude: -179 }, dateline)).toBe(true);
  expect(pointInRegion({ latitude: 30, longitude: -180 }, dateline)).toBe(true);
  expect(pointInRegion({ latitude: 30, longitude: 170 }, dateline)).toBe(false);
});

test("a maximum world viewport retains geographic poles and both longitude extremes", () => {
  const world = { latitude: 0, longitude: 0, latitudeDelta: 180, longitudeDelta: 360 };
  for (const latitude of [-90, 0, 90]) {
    for (const longitude of [-180, -179, 0, 179, 180]) {
      expect(pointInRegion({ latitude, longitude }, world)).toBe(true);
    }
  }
});

test("a warning enclosing the viewport is retained even when every vertex is offscreen", () => {
  const enclosing = polygon([[-101, 28], [-97, 28], [-97, 32], [-101, 32], [-101, 28]]);
  expect(enclosing.type === "Polygon" && enclosing.coordinates[0].every(([longitude, latitude]) =>
    !pointInRegion({ latitude, longitude }, view))).toBe(true);
  expect(geometryIntersectsRegion(enclosing, view)).toBe(true);
});

test("an area crossing the view and an area touching its edge are not culled", () => {
  const crossing = polygon([[-101, 29.5], [-97, 29.5], [-97, 30.5], [-101, 30.5], [-101, 29.5]]);
  const touching = polygon([[-98, 29.5], [-97, 29.5], [-97, 30.5], [-98, 30.5], [-98, 29.5]]);
  expect(geometryIntersectsRegion(crossing, view)).toBe(true);
  expect(geometryIntersectsRegion(touching, view)).toBe(true);
});

test("offscreen areas are culled on either latitude or longitude without dropping a multipolygon's visible part", () => {
  const remote = [[-105, 29], [-104, 29], [-104, 31], [-105, 31], [-105, 29]] as GeoPosition[];
  const north = [[-100, 32], [-98, 32], [-98, 33], [-100, 33], [-100, 32]] as GeoPosition[];
  const visible = [[-99.5, 29.5], [-98.5, 29.5], [-98.5, 30.5], [-99.5, 30.5], [-99.5, 29.5]] as GeoPosition[];
  expect(geometryIntersectsRegion(polygon(remote), view)).toBe(false);
  expect(geometryIntersectsRegion(polygon(north), view)).toBe(false);
  expect(geometryIntersectsRegion({ type: "MultiPolygon", coordinates: [[remote], [visible]] }, view)).toBe(true);
});

test("an antimeridian-spanning warning is retained when its vertices lie outside a narrow dateline view", () => {
  const dateline = { latitude: 0, longitude: -180, latitudeDelta: 2, longitudeDelta: 2 };
  const crossing = polygon([[170, -2], [-170, -2], [-170, 2], [170, 2], [170, -2]]);
  expect(geometryIntersectsRegion(crossing, dateline)).toBe(true);
});

test("holes do not become a personal applicability test during conservative overlay culling", () => {
  const geometry: AlertGeometry = {
    type: "Polygon",
    coordinates: [
      [[-102, 27], [-96, 27], [-96, 33], [-102, 33], [-102, 27]],
      [[-101, 28], [-101, 32], [-97, 32], [-97, 28], [-101, 28]],
    ],
  };
  expect(geometryIntersectsRegion(geometry, view)).toBe(true);
});

test("fits all supplied outer rings and pads the viewport without making a personal point", () => {
  const fitted = fitMapGeometries([polygon([[-100, 30], [-99, 30], [-99, 31], [-100, 30]])]);
  expect(fitted).toEqual({ point: { latitude: 30.5, longitude: -99.5 }, span: 1.2 });
  expect(fitMapGeometries([])).toBeNull();
});

test("fits nearby dateline outlines together instead of centering on the opposite side of Earth", () => {
  const fitted = fitMapGeometries([polygon([[179, -1], [-179, -1], [-179, 1], [179, -1]])])!;
  expect(fitted.point).toEqual({ latitude: 0, longitude: -180 });
  expect(fitted.span).toBe(2.4);
  expect(pointInRegion({ latitude: 0, longitude: 179 }, { ...fitted.point, latitudeDelta: fitted.span, longitudeDelta: fitted.span })).toBe(true);
});
