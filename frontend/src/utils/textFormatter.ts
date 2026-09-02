/**
 * Text Sanitizer & Formatter
 * Cleans raw AI outputs, strips unrendered LaTeX markup, converts formulas to clean readable math,
 * eliminates all emoji characters for a refined professional academic aesthetic,
 * and formats clean, structured, and beautiful typography.
 */

export function cleanAcademicText(raw: string): string {
  if (!raw) return ''

  let text = raw.trim()

  // 1. Remove all emojis (unicode ranges) for a strictly professional, clean look
  text = text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/gu, '')

  // 2. Remove introductory robotic preambles
  text = text.replace(/^(?:Here is a breakdown of[^\n:]*:?|Welcome to class[^\n:]*:?|Sure, here is the breakdown[^\n:]*:?|Let's look under the hood[^\n:]*:?)\s*/i, '')

  // 3. Clean repetitive numbered header artifacts (e.g., "1. The Big Picture", "## 1. Introduction")
  text = text.replace(/^(?:[0-9]+\.\s*(?:The Big Picture|Core Principle|Key Takeaways|Common Pitfall|Introduction|Simple Explanation|Deep Mechanics)[^\n]*\n?)+/gim, '')

  // 4. Clean and fix corrupted LaTeX escapes
  text = text.replace(/\\le\s*ft\b/g, '\\left')
  text = text.replace(/\\righ\s*t\b/g, '\\right')
  text = text.replace(/\\sq\s*rt\b/g, '\\sqrt')

  // 4b. Strip all page numbers, page citations, and raw source tags like [Source: text | Page: 27]
  text = text.replace(/\[Source:[^\]]*\]/gi, '')
  text = text.replace(/(?:^|\n)\s*Based on (?:your )?uploaded material:\s*/gi, '\n\n')
  text = text.replace(/\s*\((?:p\.|pages?)\s*\d+(?:[-–]\d+)?\)/gi, '')
  text = text.replace(/\b(?:on|from|see)\s+pages?\s+\d+(?:[-–]\d+)?\b/gi, '')

  // 5. Clean and format template prefixes (HOOK, DEFINITION, BREAKDOWN, CLOSE) into natural markdown


  text = text.replace(/(?:^|\n)\s*HOOK:\s*/gi, '\n\n')
  text = text.replace(/(?:^|\n)\s*DEFINITION:\s*/gi, '\n\n')
  text = text.replace(/(?:^|\n)\s*BREAKDOWN:\s*/gi, '\n\n')
  text = text.replace(/(?:^|\n)\s*VISUAL:\s*/gi, '\n\n')
  text = text.replace(/(?:^|\n)\s*CLOSE:\s*/gi, '\n\n**Quick check:** ')

  // Clean misformatted bullet labels like "Chord: **A straight line..." -> "- **Chord**: A straight line..."
  text = text.replace(/(?:^|\n)\s*([A-Za-z0-9\s\-_]+):\s*\*\*([^\n]+)/g, '\n- **$1**: $2')

  // 6. Structure Part A / Part B as clean markdown subheadings (without emojis)
  text = text.replace(/(?:^|\n)(?:Part\s+([A-Z0-9]+):\s*([^\n]+))/gi, '\n\n### Part $1: $2\n')

  // 7. Clean variable definitions into clean bullet points
  text = text.replace(/(?:^|\n)([a-zA-Z0-9̂_\-]+)\s*=\s*([^\n]+)/g, '\n- **$1**: $2')

  // 8. Clean horizontal line clutter
  text = text.replace(/_{4,}|-{4,}/g, '')

  // 9. Normalize consecutive blank lines
  text = text.replace(/\n{3,}/g, '\n\n')

  return text.trim()
}

