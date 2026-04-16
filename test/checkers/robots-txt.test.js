import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { check } from '../../src/checkers/robots-txt.js';
import { parseRobotsTxt } from '../../src/utils.js';
import { join } from 'node:path';

const FIXTURES = join(import.meta.dirname, '..', 'fixtures');

describe('robots-txt checker', () => {
  it('should pass for good-site with AI crawler permissions', async () => {
    const result = await check({ dir: join(FIXTURES, 'good-site'), projectDir: join(FIXTURES, 'good-site') });
    assert.equal(result.id, 'robots-txt');
    assert.equal(result.category, 'discovery');
    assert.ok(result.score >= 7, `Expected score >= 7, got ${result.score}`);
    assert.ok(result.status === 'pass' || result.status === 'warn');
  });

  it('should fail for bad-site that blocks AI crawlers', async () => {
    const result = await check({ dir: join(FIXTURES, 'bad-site'), projectDir: join(FIXTURES, 'bad-site') });
    assert.ok(result.score <= 5, `Expected score <= 5, got ${result.score}`);
    const hasBlockError = result.findings.some((f) => f.severity === 'error');
    assert.ok(hasBlockError, 'Should report blocking as an error');
  });

  it('should warn for site with no robots.txt', async () => {
    const result = await check({ dir: '/tmp/nonexistent-aeo-test', projectDir: '/tmp/nonexistent-aeo-test' });
    assert.equal(result.status, 'warn');
    assert.equal(result.score, 5);
  });

  it('should return correct metadata shape', async () => {
    const result = await check({ dir: join(FIXTURES, 'good-site'), projectDir: join(FIXTURES, 'good-site') });
    assert.ok(typeof result.id === 'string');
    assert.ok(typeof result.name === 'string');
    assert.ok(typeof result.category === 'string');
    assert.ok(typeof result.score === 'number');
    assert.ok(typeof result.maxScore === 'number');
    assert.ok(Array.isArray(result.findings));
    assert.ok(['pass', 'warn', 'fail', 'error'].includes(result.status));
  });

  it('should recognize path-specific Allow rules on a stacked user-agent group', async () => {
    const result = await check({
      dir: join(FIXTURES, 'nvidia-style-site'),
      projectDir: join(FIXTURES, 'nvidia-style-site'),
    });
    const notAllowedWarning = result.findings.find(
      (f) => f.severity === 'warning' && /No AI crawlers are explicitly allowed/.test(f.message)
    );
    assert.equal(notAllowedWarning, undefined, 'Should not warn when stacked group has path-specific Allow rules');
    const allowedInfo = result.findings.find(
      (f) => f.severity === 'info' && /explicitly allowed/.test(f.message)
    );
    assert.ok(allowedInfo, 'Should report the allowed crawlers as an info finding');
  });
});

describe('parseRobotsTxt', () => {
  it('should attribute rules to every agent in a stacked group (RFC 9309 §2.2)', () => {
    const content = [
      'User-agent: ClaudeBot',
      'User-agent: GPTBot',
      'Allow: /*.md$',
    ].join('\n');
    const rules = parseRobotsTxt(content);
    const claudeAllows = rules.filter((r) => r.agent === 'ClaudeBot' && r.allow === '/*.md$');
    const gptAllows = rules.filter((r) => r.agent === 'GPTBot' && r.allow === '/*.md$');
    assert.equal(claudeAllows.length, 1, 'ClaudeBot should inherit the group Allow rule');
    assert.equal(gptAllows.length, 1, 'GPTBot should inherit the group Allow rule');
  });

  it('should start a new group when a user-agent line follows a rule line', () => {
    const content = [
      'User-agent: ClaudeBot',
      'Allow: /a',
      'User-agent: GPTBot',
      'Allow: /b',
    ].join('\n');
    const rules = parseRobotsTxt(content);
    assert.deepEqual(
      rules.filter((r) => r.agent === 'ClaudeBot').map((r) => r.allow),
      ['/a']
    );
    assert.deepEqual(
      rules.filter((r) => r.agent === 'GPTBot').map((r) => r.allow),
      ['/b']
    );
  });
});
