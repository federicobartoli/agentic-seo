import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { check } from '../../src/checkers/llms-txt.js';
import { join } from 'node:path';

const FIXTURES = join(import.meta.dirname, '..', 'fixtures');

describe('llms-txt checker', () => {
  it('should pass for good-site with well-formed llms.txt', async () => {
    const result = await check({ dir: join(FIXTURES, 'good-site'), projectDir: join(FIXTURES, 'good-site') });
    assert.equal(result.id, 'llms-txt');
    assert.equal(result.category, 'discovery');
    assert.ok(result.score >= 6, `Expected score >= 6, got ${result.score}`);
  });

  it('should fail for bad-site with no llms.txt', async () => {
    const result = await check({ dir: join(FIXTURES, 'bad-site'), projectDir: join(FIXTURES, 'bad-site') });
    assert.equal(result.score, 0);
    assert.equal(result.status, 'fail');
    const hasError = result.findings.some((f) => f.severity === 'error');
    assert.ok(hasError, 'Should report missing llms.txt as error');
  });

  it('should have fix suggestions for failures', async () => {
    const result = await check({ dir: join(FIXTURES, 'bad-site'), projectDir: join(FIXTURES, 'bad-site') });
    const withFix = result.findings.filter((f) => f.fix);
    assert.ok(withFix.length > 0, 'Should provide fix suggestions');
  });

  it('should report an error when llms.txt has no H1 heading', async () => {
    const result = await check({ dir: join(FIXTURES, 'llms-no-h1'), projectDir: join(FIXTURES, 'llms-no-h1') });
    const h1Error = result.findings.find(
      (f) => f.severity === 'error' && /H1/.test(f.message)
    );
    assert.ok(h1Error, 'Should report a missing-H1 error finding');
  });

  it('should warn when the H1 is not the first content (code block above it)', async () => {
    const result = await check({ dir: join(FIXTURES, 'llms-h1-not-first'), projectDir: join(FIXTURES, 'llms-h1-not-first') });
    const positionWarning = result.findings.find(
      (f) => f.severity === 'warning' && /not the first content/.test(f.message)
    );
    assert.ok(positionWarning, 'Should warn that the H1 is not the first content in the file');
  });
});
