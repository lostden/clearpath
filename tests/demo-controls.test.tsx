import AsyncStorage from "@react-native-async-storage/async-storage";
import { cleanup, fireEvent, render } from "@testing-library/react-native";
import { DemoControls } from "../src/components/DemoControls";
import { AppProvider } from "../src/state/AppState";

beforeEach(async () => { await AsyncStorage.clear(); });
afterEach(async () => { await cleanup(); });

test("Explore starts the North Texas training scenario and explains its invented content", async () => {
  const screen = await render(<AppProvider><DemoControls /></AppProvider>);
  await fireEvent.press(screen.getByRole("button", { name: "Explore simulated demo" }));
  expect(screen.getByRole("button", { name: "Simulate North Texas flood", selected: true })).toBeTruthy();
  expect(screen.getByText(/invented North Texas training scenario/i)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Simulate Flood", selected: false })).toBeTruthy();
});

test("existing scenarios stay selectable and each new Explore entry starts the North Texas scene", async () => {
  const screen = await render(<AppProvider><DemoControls /></AppProvider>);
  await fireEvent.press(screen.getByRole("button", { name: "Explore simulated demo" }));
  for (const name of ["Simulate Flood", "Simulate Tornado", "Simulate No alerts", "Simulate Outage"]) {
    await fireEvent.press(screen.getByRole("button", { name }));
    expect(screen.getByRole("button", { name, selected: true })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Simulate North Texas flood", selected: false })).toBeTruthy();
  }
  await fireEvent.press(screen.getByRole("button", { name: "Return to live mode" }));
  await fireEvent.press(screen.getByRole("button", { name: "Explore simulated demo" }));
  expect(screen.getByRole("button", { name: "Simulate North Texas flood", selected: true })).toBeTruthy();
});
