import { join } from 'node:path';
import { readFileSafe, resolveFile, fetchUrl, finding, checkerResult } from '../utils.js';
import { countTokens } from '../tokenizer.js';

const ID = 'llms-txt';
const NAME = 'llms.txt Discovery Index';
const CATEGORY = 'discovery';
const MAX_SCORE = 10;

/**
 * Validate the H1 heading against the llms.txt spec.
 * The spec requires exactly one H1 and places it first in the ordered structure.
 */
function validateH1(content) {
  // Strip an optional UTF-8 BOM that some editors prepend on save.
  const safe = (content || '').replace(/^\uFEFF/, '');
  // For counting H1s, strip fenced code blocks so '# comment' lines inside
  // bash/etc. aren't matched.
  const stripped = safe.replace(/^([`~]{3,})[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, '');
  // Normalize setext H1 (`Title\n====`) to ATX (`# Title`) so the rest of the
  // checks apply uniformly. Only H1 ('='), not setext H2 ('-').
  const setextToAtx = (text) =>
    text.replace(/^(?!\s*$)([^\n]+)\n[ ]{0,3}=+[ \t]*$/gm, '# $1');
  const normStripped = setextToAtx(stripped);
  const normSafe = setextToAtx(safe);

  // CommonMark allows up to 3 spaces of indentation before an ATX heading.
  const h1Regex = /^[ ]{0,3}#\s+\S.*$/gm;
  const h1s = normStripped.match(h1Regex) || [];
  // For position, check the original (BOM-stripped, setext-normalized) content.
  const firstNonBlank = normSafe.split('\n').find((l) => l.trim() !== '') || '';
  const startsWithH1 = /^[ ]{0,3}#\s+\S/.test(firstNonBlank);

  if (h1s.length === 0) {
    return finding('error', 'llms.txt is missing the required H1 heading.',
      'Add a top-level heading with your project or site name as the first line:\n# My Project');
  }
  if (h1s.length > 1) {
    return finding('warning',
      `llms.txt contains ${h1s.length} H1 headings; the spec expects exactly one.`,
      'Keep a single top-level "# Project Name" heading. Use H2 (##) for sections.');
  }
  if (!startsWithH1) {
    return finding('warning', 'llms.txt H1 heading is not the first content in the file.',
      'Move the "# Project Name" heading to the top; the spec expects it before the blockquote summary and sections.');
  }
  return finding('info', `H1 heading present: "${h1s[0].replace(/^\s*#\s+/, '').trim()}".`);
}

/**
 * Check llms.txt exists and is well-formed.
 *
 * Scoring:
 * - File exists: +3
 * - Contains structured links: +2
 * - Has descriptions for entries: +2
 * - Includes token counts: +1
 * - Under 5000 tokens itself: +1
 * - Organized by task/section: +1
 */
export async function check(context) {
  const findings = [];
  let score = 0;

  // Try multiple locations: build dir, project root, URL
  let content = null;
  let foundPath = null;

  const filenames = ['llms.txt', 'llms-full.txt'];
  for (const filename of filenames) {
    const result = await resolveFile(context, filename);
    if (result.content) {
      content = result.content;
      foundPath = result.source === 'url' ? `${context.url}/${filename}` : filename;
      break;
    }
  }

  if (!content) {
    findings.push(
      finding('error', 'No llms.txt found at site root.',
        'Create a llms.txt file at your site root. This acts as a sitemap for AI agents.\nSee: https://llmstxt.org for the specification.')
    );
    return checkerResult(ID, NAME, CATEGORY, 0, MAX_SCORE, 'fail', findings);
  }

  // File exists
  score += 3;
  findings.push(finding('info', `llms.txt found at ${foundPath}.`));

  // Spec: single H1 with the project/site name, first in the ordered structure.
  // https://llmstxt.org
  findings.push(validateH1(content));

  // Check for structured links [title](url)
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  const links = [...content.matchAll(linkPattern)];

  if (links.length === 0) {
    findings.push(
      finding('warning', 'llms.txt contains no structured links ([title](url) format).',
        'Add Markdown-style links to your documentation pages, e.g.:\n- [Quick Start](/docs/quickstart): Get started in 5 minutes')
    );
  } else {
    score += 2;
    findings.push(finding('info', `Found ${links.length} documentation links.`));
  }

  // Check for descriptions (text after links, usually after a colon)
  const descPattern = /\[([^\]]+)\]\([^)]+\)[:\s]+\S/g;
  const descriptions = [...content.matchAll(descPattern)];

  if (descriptions.length === 0) {
    findings.push(
      finding('warning', 'Links in llms.txt lack descriptions.',
        'Add descriptions after links to help agents understand page content:\n- [API Reference](/docs/api): Full REST API with CRUD operations for users and events')
    );
  } else if (descriptions.length < links.length * 0.5) {
    score += 1;
    findings.push(finding('warning', `Only ${descriptions.length} of ${links.length} links have descriptions.`));
  } else {
    score += 2;
    findings.push(finding('info', 'Links include helpful descriptions.'));
  }

  // Check for token count annotations
  const tokenPattern = /\d+[Kk]?\s*tokens?/i;
  if (tokenPattern.test(content)) {
    score += 1;
    findings.push(finding('info', 'Token count annotations found in llms.txt.'));
  } else {
    findings.push(
      finding('warning', 'No token count annotations found.',
        'Add token counts to help agents make context budget decisions:\n- [API Reference](/docs/api): Full REST API documentation (12K tokens)')
    );
  }

  // Check file size
  const tokens = countTokens(content);
  if (tokens <= 5000) {
    score += 1;
    findings.push(finding('info', `llms.txt is ${tokens} tokens (under 5K limit).`));
  } else {
    findings.push(
      finding('warning', `llms.txt is ${tokens} tokens, exceeding the recommended 5K limit.`,
        'Trim descriptions or split into llms.txt (index) and llms-full.txt (complete content).')
    );
  }

  // Check for section headings (organized by task)
  const headings = content.match(/^#{1,3}\s+.+$/gm);
  if (headings && headings.length >= 2) {
    score += 1;
    findings.push(finding('info', `Organized into ${headings.length} sections.`));
  } else {
    findings.push(
      finding('warning', 'llms.txt lacks section organization.',
        'Organize entries under Markdown headings like ## Getting Started, ## API Reference, ## Guides.')
    );
  }

  const status = score >= 8 ? 'pass' : score >= 5 ? 'warn' : 'fail';
  return checkerResult(ID, NAME, CATEGORY, score, MAX_SCORE, status, findings);
}

export const meta = { id: ID, name: NAME, category: CATEGORY, maxScore: MAX_SCORE };
