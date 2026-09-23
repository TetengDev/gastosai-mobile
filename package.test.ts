/**
 * Guards the coverage gate in package.json.
 *
 * The gate is config, not code, so nothing else fails when it is weakened: deleting
 * `collectCoverageFrom` restores the flattered number (76.8% statements over the tested subset
 * instead of 31.2% over `src/**`), and lowering `coverageThreshold` is exactly what
 * ../docs/coverage.md forbids. Both changes leave a green suite behind unless something asserts
 * on them.
 */
import pkg from './package.json';

const jestConfig = pkg.jest;
const coverageFrom: string[] = jestConfig.collectCoverageFrom;

// Raise this alongside jest.coverageThreshold.global.lines whenever a PR raises coverage, so the
// guard never carries slack the real threshold could be lowered into.
// It may only ever go up — see ../docs/coverage.md, "The ratchet".
const FLOOR = 43;

describe('coverage denominator', () => {
  it('counts every TypeScript file under src, tested or not', () => {
    expect(coverageFrom).toContain('src/**/*.ts');
    expect(coverageFrom).toContain('src/**/*.tsx');
  });

  it('excludes only generated output, type-only files and the tests themselves', () => {
    const exclusions = coverageFrom.filter((pattern) => pattern.startsWith('!'));
    expect(exclusions.sort()).toEqual([
      '!src/**/*.d.ts',
      '!src/**/*.test.ts',
      '!src/**/*.test.tsx',
      '!src/api/generated/**',
    ]);
  });
});

describe('coverage floor', () => {
  it('is set, and never below the ratchet value', () => {
    expect(jestConfig.coverageThreshold.global.lines).toBeGreaterThanOrEqual(FLOOR);
  });

  it('is enforced by the command CI runs', () => {
    expect(pkg.scripts['test:run']).toContain('--coverage');
  });
});
