import { readFile, access, readdir, stat } from 'node:fs/promises';
import { join, extname, relative } from 'node:path';
import { constants } from 'node:fs';
import { URL } from 'node:url';

/**
 * Check if a file exists at the given path.
 */
export async function fileExists(filePath) {
  try {
    await access(filePath, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read a file's contents as UTF-8 text. Returns null if not found.
 */
export async function readFileSafe(filePath) {
  try {
    return await readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Recursively walk a directory and return all file paths matching given extensions.
 */
export async function walkDir(dir, extensions = null, ignore = []) {
  const results = [];
  const defaultIgnore = ['node_modules', '.git', '.next', '__pycache__', '.cache'];
  const allIgnore = [...defaultIgnore, ...ignore];

  async function walk(currentDir) {
    let entries;
    try {
      entries = await readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (allIgnore.includes(entry.name)) continue;

      const fullPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        if (!extensions || extensions.includes(extname(entry.name).toLowerCase())) {
          results.push(fullPath);
        }
      }
    }
  }

  await walk(dir);
  return results;
}

/**
 * Get all HTML files in a directory.
 */
export async function getHtmlFiles(dir) {
  return walkDir(dir, ['.html', '.htm']);
}

/**
 * Get all Markdown files in a directory.
 */
export async function getMarkdownFiles(dir) {
  return walkDir(dir, ['.md', '.mdx']);
}

/**
 * Strip HTML tags and extract text content.
 */
export function stripHtml(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Estimate character count to rough token count (1 token ≈ 4 chars for English).
 */
export function estimateTokensFromChars(text) {
  return Math.ceil(text.length / 4);
}

/**
 * Make a relative path from a base directory.
 */
export function relativePath(base, filePath) {
  return relative(base, filePath);
}

/**
 * Load config from .aeorc.json or package.json's "aeo" key.
 */
export async function loadConfig(dir) {
  // Try .aeorc.json
  const rcPath = join(dir, '.aeorc.json');
  const rcContent = await readFileSafe(rcPath);
  if (rcContent) {
    try {
      return JSON.parse(rcContent);
    } catch {
      // Invalid JSON, ignore
    }
  }

  // Try package.json "aeo" key
  const pkgPath = join(dir, 'package.json');
  const pkgContent = await readFileSafe(pkgPath);
  if (pkgContent) {
    try {
      const pkg = JSON.parse(pkgContent);
      if (pkg.aeo) return pkg.aeo;
    } catch {
      // Invalid JSON, ignore
    }
  }

  return {};
}

/**
 * Known AI agent user-agent strings and crawlers.
 */
export const AI_AGENTS = {
  crawlers: [
    { name: 'ClaudeBot', pattern: 'ClaudeBot' },
    { name: 'Claude-Web', pattern: 'Claude-Web' },
    { name: 'GPTBot', pattern: 'GPTBot' },
    { name: 'ChatGPT-User', pattern: 'ChatGPT-User' },
    { name: 'Google-Extended', pattern: 'Google-Extended' },
    { name: 'GoogleOther', pattern: 'GoogleOther' },
    { name: 'PerplexityBot', pattern: 'PerplexityBot' },
    { name: 'Amazonbot', pattern: 'Amazonbot' },
    { name: 'cohere-ai', pattern: 'cohere-ai' },
    { name: 'Bytespider', pattern: 'Bytespider' },
  ],
  codingAgents: [
    { name: 'Claude Code', userAgent: 'axios/1.8.4' },
    { name: 'Cursor', userAgent: 'got (sindresorhus/got)' },
    { name: 'Cline', userAgent: 'curl/8.4.0' },
    { name: 'Windsurf', userAgent: 'colly' },
    { name: 'Aider', userAgent: 'Mozilla/5.0 (Playwright)' },
    { name: 'VS Code', userAgent: 'Electron' },
  ],
};

/**
 * Parse a simple robots.txt into structured rules.
 *
 * Handles multi-agent groups per RFC 9309 (§2.1, §2.2): consecutive User-agent
 * lines before any rule share that block of rules; a User-agent line that
 * follows a rule starts a new group.
 */
export function parseRobotsTxt(content) {
  const rules = [];
  let currentAgents = [];
  let lastDirectiveWasRule = false;

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const [directive, ...rest] = trimmed.split(':');
    const value = rest.join(':').trim();
    const directiveLower = directive.toLowerCase();

    if (directiveLower === 'user-agent') {
      if (lastDirectiveWasRule) {
        currentAgents = [];
        lastDirectiveWasRule = false;
      }
      currentAgents.push(value);
    } else if (directiveLower === 'disallow' && currentAgents.length > 0) {
      for (const agent of currentAgents) {
        rules.push({ agent, disallow: value });
      }
      lastDirectiveWasRule = true;
    } else if (directiveLower === 'allow' && currentAgents.length > 0) {
      for (const agent of currentAgents) {
        rules.push({ agent, allow: value });
      }
      lastDirectiveWasRule = true;
    }
  }

  return rules;
}

/**
 * Check if a specific user-agent is blocked by robots.txt rules.
 */
export function isAgentBlocked(rules, agentName) {
  // Find rules matching this agent or wildcard
  const matching = rules.filter(
    (r) => r.agent === '*' || r.agent.toLowerCase() === agentName.toLowerCase()
  );

  // If there are specific allow rules for root, agent is not fully blocked
  const hasAllow = matching.some((r) => r.allow === '/');
  const hasDisallow = matching.some((r) => r.disallow === '/');

  if (hasDisallow && !hasAllow) return true;
  return false;
}

/**
 * Get the best directory to scan for content files from context.
 * Returns context.dir if set, or null in URL-only mode.
 * Does NOT fall back to projectDir since that may be the user's CWD
 * and not the target site.
 */
export function getContentDir(context) {
  return context.dir || null;
}

/**
 * Fetch a text resource from a URL. Returns null on failure.
 */
export async function fetchUrl(baseUrl, path = '') {
  try {
    const url = path ? new URL(path, baseUrl).href : baseUrl;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'agentic-seo/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * Read a file locally or fetch it from a URL, trying both context.dir and context.url.
 * Returns { content, source } or { content: null }.
 */
export async function resolveFile(context, filename) {
  // Try local filesystem first
  if (context.dir) {
    const content = await readFileSafe(join(context.dir, filename));
    if (content) return { content, source: 'local' };
  }
  // Try project root
  if (context.projectDir && context.projectDir !== context.dir) {
    const content = await readFileSafe(join(context.projectDir, filename));
    if (content) return { content, source: 'project' };
  }
  // Try URL
  if (context.url) {
    const content = await fetchUrl(context.url, `/${filename}`);
    if (content) return { content, source: 'url' };
  }
  return { content: null };
}

/**
 * Create a finding object.
 */
export function finding(severity, message, fix = null) {
  const f = { severity, message };
  if (fix) f.fix = fix;
  return f;
}

/**
 * Create a checker result object.
 */
export function checkerResult(id, name, category, score, maxScore, status, findings) {
  return { id, name, category, score, maxScore, status, findings };
}
