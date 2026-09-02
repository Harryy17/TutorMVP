/**
 * Utility to export formatted Markdown study notes to a clean, publication-grade PDF.
 * Preserves KaTeX math formulas, styled tables, headings, and clean academic typography.
 */

export const exportNotesToPdf = (title: string, markdownHtmlOrContainerId?: string) => {
  let contentHtml = ''

  if (markdownHtmlOrContainerId) {
    const el = document.getElementById(markdownHtmlOrContainerId)
    if (el) {
      contentHtml = el.innerHTML
    } else {
      contentHtml = markdownHtmlOrContainerId
    }
  }

  // Fallback: look for active markdown-content on page
  if (!contentHtml) {
    const activeViewer = document.querySelector('.artifact-viewer-canvas') || document.querySelector('.markdown-content')
    if (activeViewer) {
      contentHtml = activeViewer.innerHTML
    }
  }

  const printWindow = window.open('', '_blank', 'width=920,height=1000')
  if (!printWindow) {
    alert('Please allow popups in your browser to download the PDF.')
    return
  }

  const todayStr = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  printWindow.document.open()
  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <title>${title} — Study Notes</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css" />
        <style>
          @page {
            size: A4;
            margin: 18mm 16mm 18mm 16mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Charter', 'Georgia', serif;
            color: #111827;
            line-height: 1.65;
            font-size: 11pt;
            background: #ffffff;
            padding: 0;
            margin: 0;
          }
          .pdf-header {
            border-bottom: 1.5px solid #e5e7eb;
            padding-bottom: 10px;
            margin-bottom: 22px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .pdf-badge {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 8pt;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            background: #ecfdf5;
            color: #065f46;
            padding: 3px 8px;
            border-radius: 4px;
            border: 1px solid #a7f3d0;
          }
          .pdf-date {
            font-size: 8.5pt;
            color: #6b7280;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          h1 {
            font-size: 20pt;
            color: #111827;
            margin-top: 0;
            margin-bottom: 14px;
            line-height: 1.25;
            font-weight: 700;
          }
          h2 {
            font-size: 13.5pt;
            color: #1f2937;
            margin-top: 22px;
            margin-bottom: 8px;
            padding-bottom: 4px;
            border-bottom: 1px solid #e5e7eb;
            page-break-after: avoid;
            break-after: avoid;
            font-weight: 600;
          }
          h3 {
            font-size: 11.5pt;
            color: #374151;
            margin-top: 16px;
            margin-bottom: 6px;
            page-break-after: avoid;
            break-after: avoid;
            font-weight: 600;
          }
          p, li {
            color: #374151;
            margin-bottom: 8px;
          }
          ul, ol {
            padding-left: 20px;
            margin-bottom: 12px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 16px 0;
            font-size: 9.5pt;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          th {
            background-color: #f9fafb;
            border: 1px solid #d1d5db;
            padding: 7px 10px;
            text-align: left;
            font-weight: 600;
            color: #111827;
          }
          td {
            border: 1px solid #e5e7eb;
            padding: 7px 10px;
            color: #374151;
          }
          tr:nth-child(even) td {
            background-color: #fcfcfd;
          }
          blockquote {
            border-left: 3.5px solid #10b981;
            background: #f0fdf4;
            padding: 8px 14px;
            margin: 14px 0;
            border-radius: 0 6px 6px 0;
            color: #065f46;
          }
          code {
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
            background: #f3f4f6;
            padding: 2px 5px;
            border-radius: 4px;
            font-size: 9.5pt;
            color: #1f2937;
          }
          pre {
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            padding: 12px;
            border-radius: 6px;
            overflow-x: auto;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .katex-display {
            margin: 14px 0 !important;
            padding: 8px 0;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .pdf-footer {
            margin-top: 36px;
            padding-top: 12px;
            border-top: 1px solid #e5e7eb;
            font-size: 8pt;
            color: #9ca3af;
            display: flex;
            justify-content: space-between;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
        </style>
      </head>
      <body>
        <div class="pdf-header">
          <span class="pdf-badge">IndieTutor Academic Reference</span>
          <span class="pdf-date">${todayStr}</span>
        </div>
        <div class="pdf-content">
          ${contentHtml}
        </div>
        <div class="pdf-footer">
          <span>IndieTutor AI Study Platform · Verified & Grounded Study Material</span>
          <span>Page 1</span>
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 350);
          };
        </script>
      </body>
    </html>
  `)
  printWindow.document.close()
}
