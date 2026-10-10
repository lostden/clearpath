import { cleanup, fireEvent, render } from "@testing-library/react-native";
import { processColor } from "react-native";
import type { KeyboardEvent, ReactElement, ReactNode, SVGProps } from "react";
import Svg, { Path } from "react-native-svg";
import {
  CoordinateArea as WebCoordinateArea,
  CoordinateAreaGroup as WebCoordinateAreaGroup,
  CoordinateHitRect as WebCoordinateHitRect,
} from "../src/components/CoordinateTargets.web";

const { CoordinateArea, CoordinateAreaGroup, CoordinateHitRect } =
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

const groupedArea = {
  testID: "grouped-warning",
  label: "NWS verified multipart warning area",
};
// The two outer rings overlap, while each part has its own enclosed hole.
// They must remain separately painted paths rather than one evenodd path.
const groupPaths = [
  {
    testID: "warning-part-one",
    d: "M10 10 L70 10 L70 70 L10 70 Z M20 20 L30 20 L30 30 L20 30 Z",
    fill: "#FF5A00",
  },
  {
    testID: "warning-part-two",
    d: "M40 40 L90 40 L90 90 L40 90 Z M75 75 L85 75 L85 85 L75 85 Z",
    fill: "#FFD400",
  },
];

function nativeGroupChildren() {
  return groupPaths.map((part) => <Path key={part.testID} {...part}
    stroke="#FFFFFF" strokeWidth={2} fillRule="evenodd" clipRule="evenodd" />);
}

function webGroupChildren() {
  return groupPaths.map(({ testID, ...part }) => <path key={testID}
    data-testid={testID} {...part} stroke="#FFFFFF" strokeWidth={2}
    fillRule="evenodd" clipRule="evenodd" />);
}

test("native grouped overlapping parts keep independent fills and holes, with one named group action", async () => {
  const activate = jest.fn();
  const screen = await render(<Svg>
    <CoordinateAreaGroup {...groupedArea} onActivate={activate}>
      {nativeGroupChildren()}
    </CoordinateAreaGroup>
  </Svg>);
  const group = screen.getByLabelText(groupedArea.label);
  expect(group.props.testID).toBe(groupedArea.testID);
  expect(group.props.accessible).toBe(true);
  expect(group.props.accessibilityRole).toBeUndefined();
  expect(group.props.d).toBeUndefined();
  expect(screen.getAllByLabelText(groupedArea.label)).toHaveLength(1);
  for (const part of groupPaths) {
    const child = screen.getByTestId(part.testID);
    expect(child.props.d).toBe(part.d);
    expect(child.props.fill).toEqual({ type: 0, payload: processColor(part.fill) });
    expect(child.props.fillRule).toBe(0);
    expect(child.props.clipRule).toBe(0);
    expect(child.props.onPress).toBeUndefined();
    expect(child.props.accessible).toBeFalsy();
    expect(child.props.accessibilityLabel).toBeUndefined();
  }
  // fireEvent traverses the static child to its sole group callback.
  await fireEvent.press(screen.getByTestId(groupPaths[0].testID));
  expect(activate).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByTestId(groupPaths[1].testID));
  expect(activate).toHaveBeenCalledTimes(2);
});

test("native static groups retain both painted parts without a group or child activation", async () => {
  const screen = await render(<Svg>
    <CoordinateAreaGroup {...groupedArea}>{nativeGroupChildren()}</CoordinateAreaGroup>
  </Svg>);
  for (const testID of [groupedArea.testID, ...groupPaths.map((part) => part.testID)]) {
    const element = screen.getByTestId(testID);
    expect(element.props.onPress).toBeUndefined();
    expect(element.props.accessible).toBeFalsy();
  }
  expect(screen.getByTestId(groupPaths[0].testID).props.d).toBe(groupPaths[0].d);
  expect(screen.getByTestId(groupPaths[1].testID).props.d).toBe(groupPaths[1].d);
  expect(screen.queryAllByRole("button")).toHaveLength(0);
});

function webGroup(onActivate?: () => void, extras = {}) {
  return WebCoordinateAreaGroup({
    ...groupedArea, onActivate, children: webGroupChildren(), ...extras,
  }) as DomTarget;
}

describe("web grouped warning area", () => {
  test("whitelists the DOM group action without leaking native responders or replacing its callback", () => {
    const activate = jest.fn();
    const injectedPress = jest.fn();
    const injectedClick = jest.fn();
    const group = webGroup(activate, {
      onPress: injectedPress, onClick: injectedClick, accessible: true,
      accessibilityLabel: "Native label", accessibilityRole: "button",
      onStartShouldSetResponder: () => true, onResponderGrant: injectedPress,
    });
    expect(group.type).toBe("g");
    expect(group.props).toMatchObject({
      "data-testid": groupedArea.testID, "aria-label": groupedArea.label,
      role: "button", tabIndex: 0,
    });
    expect(Object.keys(group.props).sort()).toEqual([
      "data-testid", "aria-label", "role", "tabIndex", "onClick", "onKeyDown", "children",
    ].sort());
    group.props.onClick!({} as Parameters<NonNullable<typeof group.props.onClick>>[0]);
    expect(activate).toHaveBeenCalledTimes(1);
    expect(injectedPress).not.toHaveBeenCalled();
    expect(injectedClick).not.toHaveBeenCalled();
  });

  test("renders one focus stop around separately painted paths with independent evenodd holes", () => {
    const group = webGroup(jest.fn());
    const markup = renderToStaticMarkup(<svg>{group}</svg>);
    expect(markup).toContain(`<g data-testid="${groupedArea.testID}"`);
    expect(markup).toContain(`aria-label="${groupedArea.label}"`);
    expect(markup.match(/role="button"/g)).toHaveLength(1);
    expect(markup.match(/tabindex="0"/g)).toHaveLength(1);
    expect(markup.match(/<path /g)).toHaveLength(2);
    expect(markup.match(/fill-rule="evenodd"/g)).toHaveLength(2);
    expect(markup.match(/clip-rule="evenodd"/g)).toHaveLength(2);
    for (const part of groupPaths) {
      expect(markup).toContain(`d="${part.d}"`);
      expect(markup).toContain(`fill="${part.fill}"`);
    }
    for (const child of group.props.children as ReactElement<SVGProps<SVGPathElement>>[]) {
      expect(child.type).toBe("path");
      expect(Object.keys(child.props).sort()).toEqual([
        "data-testid", "d", "fill", "stroke", "strokeWidth", "fillRule", "clipRule",
      ].sort());
    }
    expect(markup).not.toMatch(/\s(?:onPress|accessible|accessibilityLabel|accessibilityRole|onResponderGrant|testID|label|onActivate)=/);
  });

  test("Enter and Space activate the group once each and ignore repeated or unrelated keys", () => {
    const activate = jest.fn();
    const onKeyDown = webGroup(activate).props.onKeyDown!;
    for (const key of ["Enter", " "]) {
      const press = keyEvent(key);
      onKeyDown(press.event);
      expect(press.preventDefault).toHaveBeenCalledTimes(1);
      const repeated = keyEvent(key, true);
      onKeyDown(repeated.event);
      expect(repeated.preventDefault).toHaveBeenCalledTimes(1);
    }
    expect(activate).toHaveBeenCalledTimes(2);
    for (const key of ["Tab", "Escape", "ArrowDown", "a"]) {
      const press = keyEvent(key);
      onKeyDown(press.event);
      expect(press.preventDefault).not.toHaveBeenCalled();
    }
    expect(activate).toHaveBeenCalledTimes(2);
  });

  test("static groups retain independent paths without any nested focus stops or handlers", () => {
    const group = webGroup();
    expect(Object.keys(group.props).sort()).toEqual(["data-testid", "aria-label", "children"].sort());
    const markup = renderToStaticMarkup(<svg>{group}</svg>);
    expect(markup).toContain(`aria-label="${groupedArea.label}"`);
    expect(markup.match(/<path /g)).toHaveLength(2);
    expect(markup).not.toMatch(/\s(?:role|tabindex|onClick|onKeyDown)=/);
  });
});
