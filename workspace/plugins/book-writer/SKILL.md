---
name: book-writer
description: 'Complete book writing assistant for authors. Covers full writing journey from ideation to publishing. Use when user wants to: (1) Start new book project, (2) Create outlines and chapter structures, (3) Write and develop content (fiction, non-fiction, technical, self-help), (4) Develop characters, plots, storylines, (5) Edit and revise manuscripts, (6) Prepare for publishing, (7) Track writing progress and goals, (8) Export to EPUB, MOBI, PDF. Supports multiple genres.'
---

# Book Writer Skill

Complete book writing assistant covering the full journey from idea to published book.

## Core Philosophy

A professional author follows a structured process:

1. **Ideation** → 2. **Research** → 3. **Outline** → 4. **Drafting** → 5. **Revision** → 6. **Editing** → 7. **Publishing**

This skill supports all stages with specialized tools and guidance.

## Quick Start

### Start a New Book Project

```
"Start a new book about [topic/genre]"
"Create an outline for a [fiction/non-fiction] book"
"Help me write chapter 1"
```

### Workflow Commands

- **Outline**: Generate chapter structure, plot points, character arcs
- **Write**: Draft scenes, chapters, sections with genre-appropriate style
- **Edit**: Revise for consistency, pacing, grammar, flow
- **Export**: Format for EPUB, MOBI, PDF, print
- **Track**: Monitor word count, progress, daily goals

## The Author's Workflow

### Stage 1: Ideation & Concept

**What authors do:**
- Define core premise (1-2 sentences)
- Identify target audience
- Research comparable books (comp titles)
- Establish unique value/angle
- Set writing goals (timeline, word count)

**Use this skill when:**
- Brainstorming book concepts
- Defining genre and audience
- Setting project scope

### Stage 2: Research & Development

**Fiction:**
- World-building (settings, rules, history)
- Character profiles (backstory, motivation, arc)
- Plot structure (three-act, hero's journey, save the cat)
- Timeline and continuity

**Non-Fiction:**
- Topic research (sources, data, interviews)
- Chapter framework (logical flow)
- Case studies and examples
- Expert positioning

**Scripts available:**
- `scripts/outline_generator.py` - Generate structured outlines
- `scripts/character_builder.py` - Create detailed character profiles (fiction)

### Stage 3: Outline Creation

**Chapter Structure:**
- Chapter-by-chapter breakdown
- Key scenes/points per chapter
- Word count estimates
- Pacing plan

**Template:**
```markdown
# Book Title

## Logline: [1-sentence summary]

## Target Audience: [reader profile]

## Chapter Outline:

### Chapter 1: [Title]
- Purpose: [what this chapter achieves]
- Key Points/Scenes: [bullet list]
- Estimated Word Count: [X,XXX]

### Chapter 2: [Title]
...
```

### Stage 4: First Draft

**Writing Process:**
- Set daily word count goals (500-2000 words typical)
- Write without self-editing (get it down, fix later)
- Track progress consistently
- Maintain voice and tone

**Skill Support:**
- Genre-specific writing patterns
- Scene/section templates
- Writing prompts for blocks
- Consistency checking

### Stage 5: Revision (Self-Edit)

**Revision Passes:**
1. **Structural** - Plot holes, pacing, chapter flow
2. **Character** - Consistency, development, motivation
3. **Scene** - Tension, dialogue, description
4. **Line** - Sentence-level improvements
5. **Word** - Trimming, tightening, word choice

**Checklists:**
- See `references/revision-checklist.md`
- Use `scripts/consistency_checker.py` for continuity

### Stage 6: Professional Editing

**Editing Types:**
- **Developmental Edit** - Big-picture structure, plot, character
- **Line Edit** - Style, voice, sentence flow
- **Copy Edit** - Grammar, punctuation, consistency
- **Proofread** - Final typo/substantive error check

**Prepare for editor:**
- Clean manuscript format
- Synopsis and author bio
- Chapter summaries

### Stage 7: Publishing Prep

**Traditional Publishing:**
- Query letter
- Book proposal (non-fiction)
- Synopsis (1-2 pages)
- Sample chapters (first 3 or full manuscript)

**Self-Publishing:**
- ISBN acquisition
- Cover design brief
- Formatting (interior layout)
- Metadata (keywords, categories, description)
- Pricing strategy

**Export:**
- `scripts/formatting_export.py` - EPUB, MOBI, PDF
- See `references/publishing-checklist.md`

## Genre-Specific Guidance

### Fiction

**Key Elements:**
- Character arc (change/growth)
- Plot structure (inciting incident, climax, resolution)
- Conflict (internal, external)
- Setting as character
- Dialogue that reveals personality

**Genres:**
- Literary fiction
- Commercial fiction
- Mystery/Thriller
- Romance
- Science Fiction/Fantasy
- Historical fiction

See `references/genre-guides.md` for detailed patterns.

### Non-Fiction

**Types:**
- Self-help / How-to
- Business / Leadership
- Memoir / Biography
- Academic / Technical
- Popular science
- History

**Structure:**
- Problem → Solution framework
- Case studies and examples
- Actionable takeaways
- Credible sourcing

### Technical Books

**Requirements:**
- Clear progression (basic → advanced)
- Code examples (tested, working)
- Exercises and challenges
- Glossary of terms
- Index

## Writing Best Practices

### Daily Habits

- **Consistent time** - Same time daily builds habit
- **Word count goal** - Track daily output
- **No editing while drafting** - separate create/revise modes
- **Read what you wrote yesterday** - warm up before new writing

### Overcoming Blocks

- **Writer's block** - Skip ahead, write out of order
- **Perfectionism** - Embrace "bad" first drafts
- **Imposter syndrome** - All authors feel this
- **Burnout** - Take breaks, change environment

### Quality Markers

- **Show don't tell** - Action reveals character
- **Active voice** - Stronger, clearer prose
- **Specific details** - Concrete over abstract
- **Pacing** - Vary sentence length, scene length
- **Voice** - Consistent authorial presence

## Using the Scripts

### outline_generator.py

Generates structured book outlines:

```bash
python scripts/outline_generator.py \
  --title "My Book" \
  --genre "fiction" \
  --chapters 12 \
  --output outline.md
```

### word_count_tracker.py

Tracks writing progress:

```bash
python scripts/word_count_tracker.py \
  --target 80000 \
  --daily-goal 1000 \
  --log progress.json
```

### formatting_export.py

Exports to publishing formats:

```bash
python scripts/formatting_export.py \
  --manuscript manuscript.docx \
  --format epub,mobi,pdf \
  --output ./exports/
```

### consistency_checker.py

Checks for continuity errors:

```bash
python scripts/consistency_checker.py \
  --manuscript chapters/*.md \
  --check characters,locations,timeline
```

## Progress Tracking

Use `scripts/word_count_tracker.py` to monitor:

- Total word count
- Chapter completion
- Daily/weekly output
- Projected completion date
- Writing streak

## Bundled Resources

### Scripts

- `scripts/outline_generator.py` - Chapter structure generation
- `scripts/word_count_tracker.py` - Progress monitoring
- `scripts/formatting_export.py` - EPUB/MOBI/PDF export
- `scripts/consistency_checker.py` - Continuity validation
- `scripts/character_builder.py` - Character profile creation

### References

- `references/genre-guides.md` - Fiction and non-fiction genre patterns
- `references/publishing-checklist.md` - Pre-publication requirements
- `references/style-guide.md` - Writing best practices
- `references/revision-checklist.md` - Self-editing checklist
- `references/plot-structures.md` - Story structure frameworks

### Assets

- `assets/book-template.docx` - Manuscript formatting template
- `assets/chapter-outline-template.md` - Chapter planning template
- `assets/character-profile-template.md` - Character development template

## Safety & Ethics

### Guidelines

1. **Originality** - Never plagiarize; generate original content
2. **Accuracy** - Fact-check non-fiction claims
3. **Sensitivity** - Handle difficult topics with care
4. **Attribution** - Credit sources and influences
5. **Quality** - Prioritize reader value over speed

### Best Practices

- Use skill for assistance, not replacement of human creativity
- Review all AI-generated content before publishing
- Maintain authentic author voice
- Respect copyright and intellectual property
