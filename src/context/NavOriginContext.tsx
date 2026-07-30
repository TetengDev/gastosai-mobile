import { createContext, useContext } from "react";

/**
 * The tab a pushed screen was opened from.
 *
 * `router.back()` cannot answer this. The screens under `href: null` are siblings of the tabs
 * rather than entries on a stack, so popping returns to the navigator's *initial* tab — editing an
 * expense from the Expenses list and saving it dropped you on Home. v0.6 fixed that for the header
 * back button by declaring a parent per screen; a screen that navigates on its own after saving
 * needs the same answer, and a fixed parent is not it when the screen is reachable from several
 * tabs.
 *
 * The layout keeps this current as you move between tabs. Defaults to Home, which is the right
 * floor for a screen opened by deep link with no history behind it.
 */
const NavOriginContext = createContext<string>("/(app)");

export const NavOriginProvider = NavOriginContext.Provider;

/** Where to return to after finishing on a pushed screen. */
export function useNavOrigin(): string {
  return useContext(NavOriginContext);
}
