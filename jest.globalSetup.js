/**
 * Forces a non-Manila process timezone for the whole test run.
 *
 * Unlike vitest, jest does not pick up a `process.env.TZ` assignment made inside a test — the
 * timezone is resolved when the worker's Date/Intl machinery initialises. Setting it here, in
 * globalSetup, happens before workers spawn, so it actually takes effect.
 *
 * This matters: without it the timezone tests pass whether or not `formatters.ts` pins
 * Asia/Manila, because the developer's own machine is already in PHT. The guard would be
 * decorative — green while the bug it exists to catch is present.
 */
module.exports = async () => {
  process.env.TZ = "America/New_York";
};
