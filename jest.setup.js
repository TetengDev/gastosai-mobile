import { jest } from "@jest/globals";
import * as mockReact from "react";
import { Text as MockText } from "react-native";
// Side-effect import: registers the library's jest matchers (`toBeOnTheScreen`, `toBeDisabled`,
// …) and its `afterEach` unmount for every test file, rather than leaving both to whether a given
// file happened to import the library first. Without that unmount, a component still holding a
// timer or a React Query subscription keeps running into the next test.
import "@testing-library/react-native";

/**
 * Per-test-file setup for React Native rendering.
 *
 * Runs in `setupFilesAfterEnv`, after the jest environment exists — unlike `jest.globalSetup.js`,
 * which runs once before any worker starts and is where the forced `TZ=America/New_York` lives.
 * The two are not interchangeable, and this file does not touch the timezone.
 *
 * ## Icons render as plain text
 *
 * `@expo/vector-icons` pulls in `expo-font`, which imports `expo-asset` at module scope.
 * `expo-asset` is installed nested under `expo/node_modules/`, where jest's resolver cannot see it
 * from `expo-font`, so importing any icon set fails the suite before a single assertion runs.
 * Metro resolves it on device, so this is a test-environment gap rather than a missing
 * dependency — hoisting it with a top-level install would add a native package to the app to fix
 * a jest resolution detail.
 *
 * Every icon set becomes a `<Text>` carrying its name, which keeps the element in the tree and
 * queryable without loading a font. Nothing in this app puts meaning in an icon alone: the
 * accessible name always lives on the pressable around it.
 *
 * The two imports it uses are named `mockReact` and `MockText` because jest hoists this factory
 * above them and rejects any out-of-scope reference that is not `mock`-prefixed.
 */
jest.mock("@expo/vector-icons", () => {
  const iconSet = (set) =>
    function Icon(props) {
      // `size` and `color` are styling and say nothing a test could assert on; `testID` is kept
      // so an icon a component labels stays addressable.
      return mockReact.createElement(MockText, { testID: props.testID }, `${set}:${props.name}`);
    };

  return new Proxy(
    { __esModule: true },
    {
      // Symbols and the interop flag are the module system asking about the module itself, not a
      // component being imported off it.
      get: (target, key) =>
        key in target || typeof key !== "string" ? target[key] : iconSet(key),
    },
  );
});
