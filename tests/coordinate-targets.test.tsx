import { cleanup, fireEvent, render } from "@testing-library/react-native";
import type { KeyboardEvent, ReactElement, ReactNode, SVGProps } from "react";
import Svg from "react-native-svg";
import {
  CoordinateArea as WebCoordinateArea,
  CoordinateHitRect as WebCoordinateHitRect,
} from "../src/components/CoordinateTargets.web";

const { CoordinateArea, CoordinateHitRect } =
  jest.requireActual<typeof import("../src/components/CoordinateTargets")>(
    "../src/components/CoordinateTargets",
  );
const { renderToStaticMarkup } = jest.requireActual<{
  renderToStaticMarkup: (element: ReactNode) => string;
}>("react-dom/server.node");

const area = {
  testID: "warning-area",
  label: "NWS cached warning area",
  d: "M10 10 L90 10 L90 90 Z M30 30 L40 30 L30 40 Z",
  fill: "rgba(176,176,176,0.20)",
  stroke: "#B0B0B0",
  strokeWidth: 2,
};
const hitRect = {
  testID: "station-hit-target",
  label: "USGS verified river station",
  x: -32,
  y: -32,
  width: 64,
  height: 64,
};

afterEach(async () => {
  await cleanup();
});

test("native warning areas and enlarged station targets activate their own callbacks", async () => {
  const selectWarning = jest.fn();
  const selectStation = jest.fn();
  const screen = await render(<Svg>
    <CoordinateArea {...area} onActivate={selectWarning} />
    <CoordinateHitRect {...hitRect} onActivate={selectStation} />
  </Svg>);
  const warning = screen.getByLabelText(area.label);
  const station = screen.getByLabelText(hitRect.label);

  expect(warning.props.d).toBe(area.d);
  // Installed SVG primitives convert even-odd to 0 and transparent to a brush.
  expect(warning.props.fillRule).toBe(0);
  expect(warning.props.accessible).toBe(true);
  expect(station.props).toMatchObject({
    x: -32, y: -32, width: 64, height: 64,
    fill: { type: 0, payload: 0 }, accessible: true,
  });
  await fireEvent.press(warning);
  expect(selectWarning).toHaveBeenCalledTimes(1);
  expect(selectStation).not.toHaveBeenCalled();
  await fireEvent.press(station);
  expect(selectWarning).toHaveBeenCalledTimes(1);
  expect(selectStation).toHaveBeenCalledTimes(1);
});

test("native static or compact targets retain geometry without nested action buttons", async () => {
  const screen = await render(<Svg>
    <CoordinateArea {...area} />
    <CoordinateHitRect {...hitRect} />
  </Svg>);
  expect(screen.queryAllByRole("button")).toHaveLength(0);
  for (const testID of [area.testID, hitRect.testID]) {
    const target = screen.getByTestId(testID);
    expect(target.props.onPress).toBeUndefined();
    expect(target.props.accessible).toBeFalsy();
  }
  expect(screen.getByTestId(area.testID).props.d).toBe(area.d);
  expect(screen.getByTestId(hitRect.testID).props.fill).toEqual({ type: 0, payload: 0 });
});

type DomTarget = ReactElement<SVGProps<SVGElement> & { "data-testid": string }>;
const webTargets = [
  {
    name: "warning area",
    tag: "path",
    label: area.label,
    testID: area.testID,
    create: (onActivate?: () => void, extras = {}) =>
      WebCoordinateArea({ ...area, onActivate, ...extras }) as DomTarget,
    drawingProps: {
      d: area.d,
      fill: area.fill,
      stroke: area.stroke,
      strokeWidth: 2,
      fillRule: "evenodd",
      clipRule: "evenodd",
    },
  },
  {
    name: "station target",
    tag: "rect",
    label: hitRect.label,
    testID: hitRect.testID,
    create: (onActivate?: () => void, extras = {}) =>
      WebCoordinateHitRect({ ...hitRect, onActivate, ...extras }) as DomTarget,
    drawingProps: { x: -32, y: -32, width: 64, height: 64, fill: "transparent" },
  },
];

function keyEvent(key: string, repeat = false) {
  const preventDefault = jest.fn();
  return {
    preventDefault,
    event: { key, repeat, preventDefault } as unknown as KeyboardEvent<SVGElement>,
  };
}

describe.each(webTargets)("web $name", (target) => {
  test("uses DOM SVG attributes and preserves click activation without leaking native responders", () => {
    const activate = jest.fn();
    const nativePress = jest.fn();
    const injectedClick = jest.fn();
    const element = target.create(activate, {
      onPress: nativePress,
      onClick: injectedClick,
      accessible: true,
      accessibilityLabel: "Native label must not reach the DOM",
      accessibilityRole: "button",
      onStartShouldSetResponder: () => true,
      onResponderGrant: nativePress,
    });

    expect(element.type).toBe(target.tag);
    expect(element.props).toMatchObject({
      ...target.drawingProps,
      "data-testid": target.testID,
      "aria-label": target.label,
      role: "button",
      tabIndex: 0,
    });
    expect(Object.keys(element.props).sort()).toEqual([
      ...Object.keys(target.drawingProps),
      "data-testid", "aria-label", "role", "tabIndex", "onClick", "onKeyDown",
    ].sort());
    element.props.onClick!({} as Parameters<NonNullable<typeof element.props.onClick>>[0]);
    expect(activate).toHaveBeenCalledTimes(1);
    expect(nativePress).not.toHaveBeenCalled();
    expect(injectedClick).not.toHaveBeenCalled();
  });

  test("renders named, focusable SVG markup with no native-only attributes", () => {
    const markup = renderToStaticMarkup(<svg>{target.create(jest.fn())}</svg>);
    expect(markup).toContain(`<${target.tag} `);
    expect(markup).toContain(`data-testid="${target.testID}"`);
    expect(markup).toContain(`aria-label="${target.label}"`);
    expect(markup).toContain('role="button"');
    expect(markup).toContain('tabindex="0"');
    expect(markup).not.toMatch(/\s(?:onPress|accessible|accessibilityLabel|accessibilityRole|onResponderGrant|testID|label|onActivate)=/);
    if (target.tag === "path") {
      expect(markup).toContain(`d="${area.d}"`);
      expect(markup).toContain('fill-rule="evenodd"');
      expect(markup).toContain('clip-rule="evenodd"');
    } else {
      expect(markup).toContain('fill="transparent"');
      expect(markup).toContain('width="64"');
      expect(markup).toContain('height="64"');
    }
  });

  test("Enter and Space each activate once, prevent scrolling, and ignore repeats and unrelated keys", () => {
    const activate = jest.fn();
    const onKeyDown = target.create(activate).props.onKeyDown!;

    for (const key of ["Enter", " "]) {
      const press = keyEvent(key);
      onKeyDown(press.event);
      expect(press.preventDefault).toHaveBeenCalledTimes(1);
      const held = keyEvent(key, true);
      onKeyDown(held.event);
    }
    expect(activate).toHaveBeenCalledTimes(2);
    for (const key of ["Tab", "Escape", "ArrowDown", "a"]) {
      const press = keyEvent(key);
      onKeyDown(press.event);
      expect(press.preventDefault).not.toHaveBeenCalled();
    }
    expect(activate).toHaveBeenCalledTimes(2);
  });

  test("static or compact SVG targets have no focus stop or activation handlers", () => {
    const element = target.create();
    expect(element.props).toMatchObject(target.drawingProps);
    for (const prop of ["role", "tabIndex", "onClick", "onKeyDown"]) {
      expect(element.props).not.toHaveProperty(prop);
    }
    const markup = renderToStaticMarkup(<svg>{element}</svg>);
    expect(markup).toContain(`aria-label="${target.label}"`);
    expect(markup).not.toMatch(/\s(?:role|tabindex|onClick|onKeyDown)=/);
  });
});
