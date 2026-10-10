import { act, cleanup, fireEvent, render } from "@testing-library/react-native";
import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import MapCanvas from "../src/components/MapCanvas";
import { DEMO_LOCATION } from "../src/data/demo";

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    executionEnvironment: "storeClient",
    expoConfig: { extra: {} },
  },
  ExecutionEnvironment: {
    StoreClient: "storeClient",
    Standalone: "standalone",
    Bare: "bare",
  },
}));

jest.mock("react-native-maps", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");
  let nextMount = 0;
  type MockProps = {
    children?: import("react").ReactNode;
    onMapReady?: () => void;
    onMapLoaded?: () => void;
  };
  const NativeMap = React.forwardRef<unknown, MockProps>(
    function NativeMap({ children, ...props }, ref) {
      const [mount] = React.useState(() => ++nextMount);
      React.useImperativeHandle(ref, () => ({ animateToRegion: jest.fn() }));
      const nativeProps = {
        ...props,
        // The real MapView always handles native readiness internally, even
        // when the application has no onMapReady callback.
        onMapReady: props.onMapReady ?? (() => {}),
        testID: "native-map",
        nativeID: `map-mount-${mount}`,
      };
      return React.createElement(View, nativeProps, children);
    },
  );
  function Marker({ children, ...props }: MockProps) {
    return React.createElement(View, { ...props, testID: "map-marker" }, children);
  }
  function Polygon({ children, ...props }: MockProps) {
    return React.createElement(View, { ...props, testID: "map-polygon" }, children);
  }
  return {
    __esModule: true,
    default: NativeMap,
    Marker,
    Polygon,
    PROVIDER_GOOGLE: "google",
  };
});

const runtime = Constants as unknown as {
  executionEnvironment: ExecutionEnvironment;
  expoConfig: { extra: { hasAndroidMapsKey?: boolean } };
};
const point = DEMO_LOCATION.coordinates;
const props = { point, alerts: [], source: "demo" as const };

function nativeMap(screen: Awaited<ReturnType<typeof render>>) {
  // Tile callbacks still arrive while the unfinished map is hidden from
  // accessibility; query that mounted native surface explicitly.
  return screen.getByTestId("native-map", { includeHiddenElements: true });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.replaceProperty(Platform, "OS", "android");
  runtime.executionEnvironment = ExecutionEnvironment.StoreClient;
  runtime.expoConfig = { extra: {} };
});

afterEach(async () => {
  await cleanup();
  jest.clearAllTimers();
  jest.useRealTimers();
});

async function advance(milliseconds: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(milliseconds);
  });
}

test("native readiness alone does not mean the map tiles finished loading", async () => {
  const screen = await render(<MapCanvas {...props} />);
  expect(screen.getByText("Loading map…")).toBeTruthy();

  await fireEvent(nativeMap(screen), "mapReady");
  expect(screen.getByText("Loading map…")).toBeTruthy();
  await advance(14_999);
  expect(screen.queryByText("Map did not finish loading")).toBeNull();
  await advance(1);
  expect(screen.getByText("Map did not finish loading")).toBeTruthy();
});

test("completed tiles clear loading and cannot later become a timed-out failure", async () => {
  const screen = await render(<MapCanvas {...props} />);
  await fireEvent(nativeMap(screen), "mapLoaded");
  expect(screen.queryByText("Loading map…")).toBeNull();

  await advance(30_000);
  expect(screen.queryByText("Map did not finish loading")).toBeNull();
  expect(screen.queryByRole("button", { name: "Retry map" })).toBeNull();
  expect(nativeMap(screen)).toBeTruthy();
});

test("the timeout offers recovery without removing the native map or alleging a specific cause", async () => {
  const screen = await render(<MapCanvas {...props} />);
  const mount = nativeMap(screen).props.nativeID;
  await advance(15_000);

  expect(screen.getByText("Map did not finish loading")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Retry map" })).toBeTruthy();
  expect(nativeMap(screen).props.nativeID).toBe(mount);
  expect(screen.queryByText("Loading map…")).toBeNull();
  expect(screen.queryByText(/expired (Google Maps )?(API )?key/i)).toBeNull();
});

test("retry remounts the native map and gives the replacement a fresh loading deadline", async () => {
  const screen = await render(<MapCanvas {...props} />);
  const originalMount = nativeMap(screen).props.nativeID;
  await advance(15_000);
  await fireEvent.press(screen.getByRole("button", { name: "Retry map" }));

  expect(nativeMap(screen).props.nativeID).not.toBe(originalMount);
  expect(screen.getByText("Loading map…")).toBeTruthy();
  expect(screen.queryByText("Map did not finish loading")).toBeNull();
  await advance(14_999);
  expect(screen.queryByText("Map did not finish loading")).toBeNull();
  await advance(1);
  expect(screen.getByText("Map did not finish loading")).toBeTruthy();
});

test("late tile completion clears a timeout without requiring a retry", async () => {
  const screen = await render(<MapCanvas {...props} />);
  const originalMount = nativeMap(screen).props.nativeID;
  await advance(15_000);
  expect(screen.getByText("Map did not finish loading")).toBeTruthy();

  await fireEvent(nativeMap(screen), "mapLoaded");
  expect(nativeMap(screen).props.nativeID).toBe(originalMount);
  expect(screen.queryByText("Map did not finish loading")).toBeNull();
  expect(screen.queryByRole("button", { name: "Retry map" })).toBeNull();
});

test("changing the selected point resets readiness and ignores completion from the previous map", async () => {
  const screen = await render(<MapCanvas {...props} />);
  const originalMap = nativeMap(screen);
  const previousCompletion = originalMap.props.onMapLoaded as () => void;
  const originalMount = originalMap.props.nativeID;
  await fireEvent(originalMap, "mapLoaded");
  await advance(10_000);

  await screen.rerender(
    <MapCanvas
      {...props}
      point={{ latitude: point.latitude + 0.1, longitude: point.longitude }}
    />,
  );
  expect(nativeMap(screen).props.nativeID).not.toBe(originalMount);
  expect(screen.getByText("Loading map…")).toBeTruthy();
  await act(async () => previousCompletion());
  expect(screen.getByText("Loading map…")).toBeTruthy();
  await advance(14_999);
  expect(screen.queryByText("Map did not finish loading")).toBeNull();
  await advance(1);
  expect(screen.getByText("Map did not finish loading")).toBeTruthy();
});

test("an Android standalone build without a configured map key keeps the existing explanation", async () => {
  runtime.executionEnvironment = ExecutionEnvironment.Standalone;
  const screen = await render(<MapCanvas {...props} />);
  expect(
    screen.getByText(/The map needs a configured Google Maps key in this Android build/),
  ).toBeTruthy();
  expect(
    screen.queryByTestId("native-map", { includeHiddenElements: true }),
  ).toBeNull();
  expect(screen.queryByText("Loading map…")).toBeNull();
  expect(screen.queryByRole("button", { name: "Retry map" })).toBeNull();
});

test("a compact timeout leaves a status without a nested retry or recenter action", async () => {
  const screen = await render(<MapCanvas {...props} compact />);
  await advance(15_000);
  expect(screen.getByText("Map unavailable")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Retry map" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Recenter" })).toBeNull();
  expect(nativeMap(screen)).toBeTruthy();
});

test("iOS Expo Go retains Apple Maps without a Google-only tile completion deadline", async () => {
  jest.replaceProperty(Platform, "OS", "ios");
  const screen = await render(<MapCanvas {...props} />);
  expect(nativeMap(screen).props.provider).toBeUndefined();
  expect(screen.queryByText("Loading map…")).toBeNull();
  expect(screen.getByRole("button", { name: "Recenter" })).toBeTruthy();

  await advance(30_000);
  expect(screen.queryByText("Map did not finish loading")).toBeNull();
  expect(screen.queryByText("Loading map…")).toBeNull();
  expect(screen.queryByRole("button", { name: "Retry map" })).toBeNull();
  expect(screen.getByRole("button", { name: "Recenter" })).toBeTruthy();
});
