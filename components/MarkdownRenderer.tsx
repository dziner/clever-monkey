// Fix: Use namespace import for React to resolve JSX intrinsic element errors.
import * as React from 'react';

// Moved outside of the component and exported for reuse
export const renderInline = (text: string): React.ReactNode => {
    if (!text) return text;
    const segments: (string | React.ReactNode)[] = [text];

    // A helper to process segments with a regex
    const process = (pattern: RegExp, wrapper: (s: string, key: number) => React.ReactNode) => {
        let keyIndex = 0;
        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            if (typeof segment === 'string') {
                const parts = segment.split(pattern);
                if (parts.length > 1) {
                    const newSegments: (string | React.ReactNode)[] = [];
                    parts.forEach((part, j) => {
                        if (j % 2 === 1) { // Matched part
                            newSegments.push(wrapper(part, keyIndex++));
                        } else if (part) { // Non-matched part
                            newSegments.push(part);
                        }
                    });
                    segments.splice(i, 1, ...newSegments);
                    i += newSegments.length - 1;
                }
            }
        }
    };

    process(/\*\*(.*?)\*\*/g, (s, k) => <strong key={`b-${k}`}>{s}</strong>);
    process(/\*(.*?)\*/g, (s, k) => <em key={`i-${k}`} className="italic">{s}</em>);
    process(/`(.*?)`/g, (s, k) => <code key={`c-${k}`} className="bg-ink-200 text-ink-800 rounded px-1 py-0.5 text-sm font-mono">{s}</code>);
    
    return <>{segments.map((s, i) => <React.Fragment key={i}>{s}</React.Fragment>)}</>;
};

const getIndentation = (line: string) => line.match(/^\s*/)?.[0].length ?? 0;
const getListItem = (line: string) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
        return { type: 'ul' as const, content: trimmed.substring(2) };
    }
    const olMatch = trimmed.match(/^(\d+)\.\s(.*)/);
    if (olMatch) {
        return { type: 'ol' as const, content: olMatch[2] };
    }
    // For quiz options like a., b., etc.
    const alphaMatch = trimmed.match(/^[a-z]\.\s(.*)/i);
     if (alphaMatch) {
        return { type: 'ul' as const, content: trimmed }; // Treat as a 'ul' for styling
    }
    return null;
}

export const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
    const blocks: React.ReactNode[] = [];
    const lines = content.split('\n');
    
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        const trimmedLine = line.trim();

        if (trimmedLine.startsWith('# ')) {
            blocks.push(<h1 key={blocks.length} className="text-2xl font-bold mt-6 mb-3">{renderInline(trimmedLine.substring(2))}</h1>);
            i++;
        } else if (trimmedLine.startsWith('## ')) {
            blocks.push(<h2 key={blocks.length} className="text-xl font-bold mt-5 mb-2 pb-1 border-b border-ink-200">{renderInline(trimmedLine.substring(3))}</h2>);
            i++;
        } else if (trimmedLine.startsWith('### ')) {
            blocks.push(<h3 key={blocks.length} className="text-lg font-semibold mt-4 mb-2">{renderInline(trimmedLine.substring(4))}</h3>);
            i++;
        } else if (trimmedLine.startsWith('> ')) {
            const quoteLines = [];
            while(i < lines.length && lines[i].trim().startsWith('> ')) {
                quoteLines.push(lines[i].trim().substring(2));
                i++;
            }
            blocks.push(
                <blockquote key={`quote-${blocks.length}`} className="border-l-4 border-ink-300 pl-4 my-4 text-ink-700 italic">
                    {quoteLines.map((qline, qi) => <p key={qi} className="mb-1">{renderInline(qline)}</p>)}
                </blockquote>
            );
        } else if (trimmedLine.startsWith('```')) {
            const codeLines = [];
            i++; // Move past the opening ```
            while(i < lines.length && !lines[i].trim().startsWith('```')) {
                codeLines.push(lines[i]);
                i++;
            }
            i++; // Move past the closing ```
            blocks.push(
                <pre key={`code-${blocks.length}`} className="bg-ink-800 text-white rounded-lg p-4 my-4 overflow-x-auto text-sm">
                    <code>{codeLines.join('\n')}</code>
                </pre>
            );
        } else if (getListItem(line) !== null) {
            const renderList = (startIndex: number, initialIndent: number): { node: React.ReactNode, nextIndex: number } => {
                const listItems: React.ReactNode[] = [];
                const firstItem = getListItem(lines[startIndex]);
                if (!firstItem) return { node: null, nextIndex: startIndex };
                
                const ListTag = firstItem.type;
                let currentIndex = startIndex;

                while (currentIndex < lines.length) {
                    const currentLine = lines[currentIndex];
                    const indent = getIndentation(currentLine);
                    const item = getListItem(currentLine);

                    if (indent < initialIndent || !item) {
                        break; // End of current list level
                    }

                    if (indent > initialIndent) {
                        // Nested list
                        const { node: nestedList, nextIndex } = renderList(currentIndex, indent);
                        if (nestedList && listItems.length > 0) {
                            // Attach nested list to the last item
                            const lastItem = listItems[listItems.length-1];
                            if (React.isValidElement(lastItem)) {
                                const newChildren = [...React.Children.toArray((lastItem.props as { children?: React.ReactNode }).children), nestedList];
                                listItems[listItems.length - 1] = React.cloneElement(lastItem, lastItem.props, ...newChildren);
                            }
                        }
                        currentIndex = nextIndex;
                        continue;
                    }

                    if (item.type === ListTag || ListTag === 'ol') { // Allow mixed markers in ol for a.,b. etc.
                         listItems.push(<li key={currentIndex}>{renderInline(item.content)}</li>);
                    } else {
                        break;
                    }
                    currentIndex++;
                }
                
                const className = ListTag === 'ul' 
                    ? `list-disc pl-6 my-2 space-y-1` 
                    : `list-decimal pl-6 my-2 space-y-1`;

                return { 
                    node: React.createElement(ListTag, { key: `list-${startIndex}`, className: className }, ...listItems), 
                    nextIndex: currentIndex
                };
            };
            const { node, nextIndex } = renderList(i, getIndentation(line));
            if (node) blocks.push(node);
            i = nextIndex;
        } else {
            if (trimmedLine) {
                blocks.push(<p key={blocks.length} className="my-2 leading-relaxed">{renderInline(trimmedLine)}</p>);
            }
            i++;
        }
    }

    return <div className="leading-normal">{blocks}</div>;
};