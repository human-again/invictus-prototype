'use client';

/**
 * Simple markdown renderer for protocol text
 * Handles basic markdown formatting: headers, bold, italic, lists, code blocks
 */
export default function MarkdownRenderer({ content }: { content: string }) {
  if (!content) return null;

  // Split content into lines for processing
  const lines = content.split('\n');
  const elements: React.ReactElement[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let listItems: string[] = [];
  let inList = false;

  const processList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="list-disc list-inside space-y-1 mb-4 ml-4">
          {listItems.map((item, idx) => (
            <li key={idx} className="text-gray-800">{renderInlineMarkdown(item.trim())}</li>
          ))}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  const renderInlineMarkdown = (text: string): React.ReactNode => {
    // Escape HTML first
    const escapeHtml = (str: string) => {
      const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      };
      return str.replace(/[&<>"']/g, (m) => map[m]);
    };

    let html = escapeHtml(text);
    
    // Handle bold **text** or __text__ (do this before italic to avoid conflicts)
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
    
    // Handle italic *text* or _text_ (but not if it's part of bold)
    html = html.replace(/(?<!\*)\*(?!\*)([^*]+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
    html = html.replace(/(?<!_)_(?!_)([^_]+?)(?<!_)_(?!_)/g, '<em>$1</em>');
    
    // Handle inline code `code`
    html = html.replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono">$1</code>');
    
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

  lines.forEach((line, index) => {
    // Handle code blocks
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        // End code block
        processList();
        elements.push(
          <pre key={`code-${elements.length}`} className="bg-gray-100 p-4 rounded-lg overflow-x-auto mb-4 font-mono text-sm">
            <code>{codeBlockContent.join('\n')}</code>
          </pre>
        );
        codeBlockContent = [];
        inCodeBlock = false;
      } else {
        // Start code block
        processList();
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      return;
    }

    // Handle headers
    if (line.startsWith('### ')) {
      processList();
      elements.push(
        <h3 key={`h3-${index}`} className="text-lg font-bold text-gray-900 mt-6 mb-3">
          {renderInlineMarkdown(line.substring(4))}
        </h3>
      );
      return;
    }

    if (line.startsWith('## ')) {
      processList();
      elements.push(
        <h2 key={`h2-${index}`} className="text-xl font-bold text-gray-900 mt-8 mb-4">
          {renderInlineMarkdown(line.substring(3))}
        </h2>
      );
      return;
    }

    if (line.startsWith('# ')) {
      processList();
      elements.push(
        <h1 key={`h1-${index}`} className="text-2xl font-bold text-gray-900 mt-8 mb-4">
          {renderInlineMarkdown(line.substring(2))}
        </h1>
      );
      return;
    }

    // Handle list items
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      if (!inList) {
        processList();
        inList = true;
      }
      listItems.push(line.trim().substring(2));
      return;
    }

    // Process list if we hit a non-list line
    if (inList && line.trim() !== '') {
      processList();
    }

    // Handle horizontal rule
    if (line.trim() === '---' || line.trim() === '***') {
      processList();
      elements.push(<hr key={`hr-${index}`} className="my-4 border-gray-300" />);
      return;
    }

    // Handle regular paragraphs
    if (line.trim() !== '') {
      processList();
      elements.push(
        <p key={`p-${index}`} className="mb-3 text-gray-800 leading-relaxed">
          {renderInlineMarkdown(line)}
        </p>
      );
    } else if (line.trim() === '' && elements.length > 0) {
      // Empty line - add spacing
      elements.push(<br key={`br-${index}`} />);
    }
  });

  // Process any remaining list
  processList();

  return <div className="markdown-content">{elements}</div>;
}

