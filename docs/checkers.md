# Checker Reference

Detailed documentation for each AEO audit check.

## Discovery Checks

### robots-txt (10 points)

Audits your `robots.txt` for AI agent accessibility.

**What it checks:**
- File exists at site root (+2)
- No wildcard `Disallow: /` blocking all bots (+3)
- Known AI crawlers (ClaudeBot, GPTBot, PerplexityBot, Google-Extended, etc.) not explicitly blocked (+3)
- AI crawlers explicitly allowed with `Allow: /` rules (+2)

**Known AI crawlers checked:**
- ClaudeBot, Claude-User, Claude-SearchBot, Claude-Web (Anthropic)
- GPTBot, ChatGPT-User, OAI-SearchBot (OpenAI)
- Google-Extended, GoogleOther (Google)
- Applebot-Extended (Apple)
- Meta-ExternalAgent, Meta-ExternalFetcher (Meta)
- PerplexityBot, Perplexity-User (Perplexity)
- Amazonbot (Amazon)
- cohere-ai (Cohere)
- Bytespider (ByteDance)

**Fix example:**
```
User-agent: ClaudeBot
Allow: /

User-agent: GPTBot
Allow: /

User-agent: PerplexityBot
Allow: /
```

---

### llms-txt (10 points)

Checks for a well-formed `llms.txt` file, which serves as a structured index for AI agents.

**What it checks:**
- File exists at root (`llms.txt` or `llms-full.txt`) (+3)
- Contains Markdown-style links `[title](url)` (+2)
- Links include descriptions (+2)
- Token count annotations present (+1)
- File itself is under 5,000 tokens (+1)
- Organized with section headings (+1)

**Specification:** https://llmstxt.org

---

### agents-md (5 points)

Checks for AGENTS.md, CLAUDE.md, or equivalent agent instruction files.

**What it checks:**
- File exists in repo root (+2)
- Contains project structure information (+1)
- Contains links to docs/APIs (+1)
- Contains coding conventions (+1)

**Files searched:** `AGENTS.md`, `CLAUDE.md`, `.claude/CLAUDE.md`, `COPILOT.md`, `.github/AGENTS.md`

---

## Content Structure Checks

### content-structure (15 points)

Analyzes HTML content for agent-readability.

**What it checks:**
- Consistent heading hierarchy H1 → H2 → H3 (no skipping) (+4)
- Code examples present in `<pre><code>` blocks (+3)
- Tables used for structured data (+2)
- Semantic HTML elements (`<main>`, `<article>`, `<section>`) (+3)
- Pages lead with descriptive content (+3 informational)

Samples up to 20 HTML pages from the site.

---

### markdown-availability (10 points)

Checks if documentation is available as clean Markdown.

**What it checks:**
- Markdown source files exist alongside HTML (+4)
- HTML pages have low tag-to-content ratio (+3)
- Content accessible without JavaScript rendering (+3)

Agents process Markdown with dramatically lower token overhead than HTML.

---

## Token Economics Checks

### token-budget (15 points)

Analyzes token counts across all documentation pages.

**What it checks:**
- Average page under 25K tokens (+5)
- No page over 50K tokens (+4)
- 80%+ of pages under 30K tokens (+3)
- Analyzable content exists (+3)

**Token thresholds:**
- Quick start pages: < 15K tokens
- API reference pages: < 25K tokens
- General pages: < 30K tokens
- Critical threshold: 50K tokens

---

### meta-tags (10 points)

Checks for AI-friendly metadata in HTML pages.

**What it checks:**
- Token count in meta tags (`<meta name="ai:token-count">`) (+3)
- Description meta tags present and meaningful (+2)
- Page type metadata (`<meta name="ai:page-type">`) (+2)
- Clean, descriptive title tags (+2)
- Canonical URLs (+1)

---

## Capability Signaling Checks

### skill-md (10 points)

Checks for skill.md files that describe API/service capabilities.

**What it checks:**
- At least one skill.md exists (+3)
- Has YAML frontmatter with name and description (+2)
- Describes capabilities (+2)
- Documents required inputs (+1)
- Documents constraints/limits (+1)
- Includes documentation links (+1)

---

### agent-permissions (5 points)

Checks for agent access control configuration.

**What it checks:**
- File exists (`agent-permissions.json`, `.well-known/agent-permissions.json`) (+2)
- Valid JSON structure (+1)
- Defines allowed interactions (+1)
- Includes rate limit information (+1)

This is an emerging standard, so it produces a soft warning rather than a hard failure.

---

## UX Bridge Checks

### copy-for-ai (10 points)

Checks for UX affordances that bridge human and agent workflows.

**What it checks:**
- "Copy for AI" buttons or `data-copy-ai` attributes (+4)
- Copy-to-clipboard buttons on code blocks (+3)
- Links to raw/Markdown views (+3)
