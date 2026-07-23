---
name: llm-wiki
description: >-
  Maintain a persistent, LLM-built knowledge wiki — ingest raw sources into
  interlinked markdown pages, query the wiki with citations, and lint it for
  health. Use when working in a folder laid out as raw/ (immutable source
  documents) + wiki/ (LLM-generated pages) + index.md + log.md. Triggers:
  "ingest this source", "process the raw articles", "add this to the wiki",
  "query the wiki", "what does the wiki say about…", "lint the wiki",
  "health-check the wiki".
---

# LLM Wiki

A pattern for building a personal knowledge base that **compounds**. Instead of
re-deriving knowledge from raw documents on every question (RAG), you
incrementally build and maintain a structured, interlinked wiki that sits
between you and the sources. Knowledge is compiled once, then kept current.

**You curate sources, explore, and ask questions. You (the agent) do all the
bookkeeping** — summarising, cross-referencing, filing, flagging contradictions,
keeping the index and log current. The human rarely writes wiki pages directly.

## The three layers

A wiki is any folder containing these:

- **`raw/`** — curated source documents (clipped articles, papers, notes, data).
  **Immutable.** Read from them, never modify them. This is the source of truth.
- **`wiki/`** — your generated markdown pages: source summaries, entity pages,
  concept pages, comparisons, an overview, a synthesis. You own this layer
  entirely.
- **`index.md`** — content catalogue of the wiki (see below).
- **`log.md`** — append-only chronological record of ingests / queries / lints.

`index.md` and `log.md` may live at the wiki root. If a wiki has no `log.md`
yet, create one on first ingest. If `index.md` is an overview/summary page
rather than a catalogue, keep its overview content and add a catalogue section.

### index.md — content-oriented

A catalogue of every wiki page: each listed with a link, a one-line summary, and
optionally metadata (date, source count). Organise by category (overview,
entities, concepts, sources, comparisons). Read this **first** when answering a
query, then drill into the pages it points to. At moderate scale (~100 sources)
this replaces embedding-based RAG entirely.

### log.md — chronological

Append-only. Start every entry with a consistent prefix so it stays greppable:

```
## [2026-06-19] ingest | Sound of Music Tour (salzburg.info)
- Wrote wiki/sound-of-music-tour.md; updated wiki/salzburg.md, index.md
```

`grep "^## \[" log.md | tail -5` then gives the last five events. Ops are
`ingest`, `query`, `lint`.

## Operations

### Ingest

The user drops a source into `raw/` and asks you to process it. One source may
touch 10–15 wiki pages.

1. **Read the source** in `raw/`. If it references local images
   (`raw/assets/…`), read the text first, then view key images separately for
   context — you can't read inline images in one pass.
2. **Discuss key takeaways** with the user before writing, unless they've asked
   for unsupervised batch ingest.
3. **Write/update the source's summary page** in `wiki/` (one page per source).
4. **Update relevant entity and concept pages** across `wiki/` — strengthen or
   challenge the synthesis, and **flag where the new source contradicts existing
   claims** rather than silently overwriting. Create new entity/concept pages
   when the source introduces something that deserves its own page.
5. **Cross-link.** Add `[[wikilinks]]` between related pages in both directions.
   A new page with no inbound links is a bug.
6. **Update `index.md`** — add/update the catalogue row(s).
7. **Append to `log.md`** — one `ingest` entry listing the pages touched.

### Query

The user asks a question against the wiki.

1. **Read `index.md` first** to find candidate pages, then read them.
2. **Synthesise an answer with citations** — link the wiki pages (and the
   underlying `raw/` source where it matters) that support each claim.
3. Choose the form that fits: prose, a comparison table, a checklist, a chart.
4. **Offer to file good answers back into the wiki** as a new page. A comparison,
   an analysis, or a connection you discovered is valuable — don't let it vanish
   into chat. If filed, update `index.md` and append a `query` entry to `log.md`.

### Lint

Periodically health-check the wiki. Report findings (don't auto-fix without
confirmation), grouped:

- **Contradictions** between pages.
- **Stale claims** a newer source has superseded.
- **Orphan pages** with no inbound links.
- **Missing pages** — concepts mentioned across pages but lacking their own page.
- **Missing cross-references** between clearly related pages.
- **Data gaps** that a web search or a new source could fill.

Lint is also where you suggest new questions to investigate and new sources to
find. Append a `lint` entry to `log.md`.

## Conventions

- **Never edit `raw/`.** If a source is wrong, note the correction in the wiki,
  not the source.
- **Wikilinks** `[[page-name]]` for cross-references (Obsidian-native). Use
  relative markdown links if the wiki already uses those.
- **Lowercase kebab-case** filenames: `sound-of-music-tour.md`.
- **One source → one summary page.** Entity and concept pages are evergreen —
  update them over time, don't duplicate.
- **Defer to a local `AGENTS.md` / `CLAUDE.md`** if the wiki lives inside a repo
  with its own contract: follow its frontmatter schema, prose style (e.g.
  British English), index format, and commit discipline. The repo's contract
  wins over this skill's defaults. If the contract requires committing notes
  with their index update, do that as part of the operation.
- **Stay involved by default.** Ingest one source at a time and surface what you
  changed unless the user explicitly asks to batch many at once.
