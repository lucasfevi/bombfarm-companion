import { describe, expect, it } from 'vitest';
import { extractChangelogSection } from './changelog-section.mjs';

const changelog = `# @bombfarm/desktop

## 0.2.0

### Minor Changes

- Added planner export

## 0.1.0

### Patch Changes

- Fixed footer spacing

### Patch Changes

- Updated dependency

## 0.1.0-beta.1

### Patch Changes

- Beta-only fix
`;

describe('extractChangelogSection', () => {
  it('extracts the first section body without the heading', () => {
    expect(extractChangelogSection(changelog, '0.2.0')).toBe(
      '### Minor Changes\n\n- Added planner export',
    );
  });

  it('extracts a middle section with multiple subsections', () => {
    expect(extractChangelogSection(changelog, '0.1.0')).toBe(
      '### Patch Changes\n\n- Fixed footer spacing\n\n### Patch Changes\n\n- Updated dependency',
    );
  });

  it('extracts the last section', () => {
    expect(extractChangelogSection(changelog, '0.1.0-beta.1')).toBe(
      '### Patch Changes\n\n- Beta-only fix',
    );
  });

  it('returns null when the version is absent', () => {
    expect(extractChangelogSection(changelog, '9.9.9')).toBeNull();
  });

  it('does not match a version that is only a prefix of another heading', () => {
    expect(extractChangelogSection(changelog, '0.1.0')).not.toContain('Beta-only fix');
    expect(extractChangelogSection(changelog, '0.1.0-beta')).toBeNull();
  });

  it('returns an empty string when the section has no body', () => {
    const sparse = '# pkg\n\n## 1.0.0\n\n## 0.9.0\n\n- older';
    expect(extractChangelogSection(sparse, '1.0.0')).toBe('');
  });
});
