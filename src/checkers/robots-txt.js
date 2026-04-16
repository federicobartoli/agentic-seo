import { join } from 'node:path';
import { readFileSafe, resolveFile, parseRobotsTxt, isAgentBlocked, AI_AGENTS, finding, checkerResult } from '../utils.js';

const ID = 'robots-txt';
const NAME = 'Robots.txt AI Access';
const CATEGORY = 'discovery';
const MAX_SCORE = 10;

/**
 * Check robots.txt for AI agent accessibility.
 *
 * Scoring:
 * - File exists: +2
 * - No wildcard block on /docs or /: +3
 * - Known AI crawlers not explicitly blocked: +3
 * - Explicitly allows AI crawlers: +2
 */
export async function check(context) {
  const findings = [];
  let score = 0;

  const { content } = await resolveFile(context, 'robots.txt');

  if (!content) {
    // No robots.txt - not necessarily bad, agents can access everything
    findings.push(finding('info', 'No robots.txt found. Agents can access all content by default.'));
    findings.push(
      finding('warning', 'Consider adding a robots.txt that explicitly permits AI agent crawlers.',
        'Create a robots.txt with:\nUser-agent: ClaudeBot\nAllow: /\n\nUser-agent: GPTBot\nAllow: /')
    );
    score = 5; // Neutral - no file means no blocks but also no explicit permission
    return checkerResult(ID, NAME, CATEGORY, score, MAX_SCORE, 'warn', findings);
  }

  // File exists
  score += 2;
  findings.push(finding('info', 'robots.txt found.'));

  const rules = parseRobotsTxt(content);

  // Check for wildcard blocks
  const wildcardBlock = rules.some(
    (r) => r.agent === '*' && r.disallow === '/'
  );

  if (wildcardBlock) {
    findings.push(
      finding('error', 'robots.txt blocks all agents with "Disallow: /" for User-agent: *.',
        'Add specific Allow rules for AI crawlers, or remove the blanket Disallow: / rule.')
    );
  } else {
    score += 3;
  }

  // Check specific AI crawlers
  const blockedCrawlers = [];
  const allowedCrawlers = [];

  for (const crawler of AI_AGENTS.crawlers) {
    if (isAgentBlocked(rules, crawler.name)) {
      blockedCrawlers.push(crawler.name);
    } else {
      // Any non-empty Allow rule for this agent counts as an explicit
      // allowance (e.g. `Allow: /`, `Allow: /*.md$`, `Allow: /docs/`).
      const hasExplicitAllow = rules.some(
        (r) =>
          r.agent.toLowerCase() === crawler.name.toLowerCase() &&
          typeof r.allow === 'string' &&
          r.allow !== ''
      );
      if (hasExplicitAllow) {
        allowedCrawlers.push(crawler.name);
      }
    }
  }

  if (blockedCrawlers.length > 0) {
    findings.push(
      finding('error',
        `AI crawlers explicitly blocked: ${blockedCrawlers.join(', ')}`,
        `Add Allow rules for these crawlers:\n${blockedCrawlers.map((c) => `User-agent: ${c}\nAllow: /`).join('\n\n')}`)
    );
  } else {
    score += 3;
    findings.push(finding('info', 'No known AI crawlers are explicitly blocked.'));
  }

  if (allowedCrawlers.length > 0) {
    score += 2;
    findings.push(finding('info', `AI crawlers explicitly allowed: ${allowedCrawlers.join(', ')}`));
  } else {
    findings.push(
      finding('warning',
        'No AI crawlers are explicitly allowed in robots.txt.',
        'Add explicit Allow rules for AI crawlers like ClaudeBot, GPTBot, PerplexityBot.')
    );
  }

  const status = score >= 8 ? 'pass' : score >= 5 ? 'warn' : 'fail';
  return checkerResult(ID, NAME, CATEGORY, score, MAX_SCORE, status, findings);
}

export const meta = { id: ID, name: NAME, category: CATEGORY, maxScore: MAX_SCORE };
