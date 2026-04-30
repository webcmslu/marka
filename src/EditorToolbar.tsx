import {
  Bold, Italic, Strikethrough, Code, Code2,
  Heading1, Heading2, Heading3,
  Quote, List, ListOrdered,
  Link, Image, Minus,
} from 'lucide-react';

export type Transform = (
  ta: HTMLTextAreaElement,
  content: string,
) => { content: string; selStart: number; selEnd: number };

// Wrap selected text (or placeholder) with prefix/suffix
function inline(prefix: string, suffix: string, placeholder: string): Transform {
  return (ta, content) => {
    const s = ta.selectionStart, e = ta.selectionEnd;
    const sel = content.slice(s, e) || placeholder;
    const rep = prefix + sel + suffix;
    const hadSel = e > s;
    return {
      content: content.slice(0, s) + rep + content.slice(e),
      selStart: hadSel ? s : s + prefix.length,
      selEnd:   hadSel ? s + rep.length : s + prefix.length + placeholder.length,
    };
  };
}

// Toggle a heading prefix (replaces any existing heading level)
function heading(prefix: string): Transform {
  return (ta, content) => {
    const s = ta.selectionStart;
    const lineStart = content.lastIndexOf('\n', s - 1) + 1;
    const lineEnd   = content.indexOf('\n', s);
    const end       = lineEnd === -1 ? content.length : lineEnd;
    const line      = content.slice(lineStart, end);
    const existing  = line.match(/^#{1,6} /)?.[0] ?? '';
    const stripped  = line.slice(existing.length);
    const newLine   = existing === prefix ? stripped : prefix + stripped;
    const delta     = newLine.length - line.length;
    return {
      content:  content.slice(0, lineStart) + newLine + content.slice(end),
      selStart: Math.max(lineStart, s + delta),
      selEnd:   Math.max(lineStart, s + delta),
    };
  };
}

// Toggle a line-level prefix (blockquote, lists)
function linePrefix(prefix: string): Transform {
  return (ta, content) => {
    const s         = ta.selectionStart;
    const lineStart = content.lastIndexOf('\n', s - 1) + 1;
    const rest      = content.slice(lineStart);
    if (rest.startsWith(prefix)) {
      return {
        content:  content.slice(0, lineStart) + rest.slice(prefix.length),
        selStart: Math.max(lineStart, s - prefix.length),
        selEnd:   Math.max(lineStart, s - prefix.length),
      };
    }
    return {
      content:  content.slice(0, lineStart) + prefix + content.slice(lineStart),
      selStart: s + prefix.length,
      selEnd:   s + prefix.length,
    };
  };
}

// Insert a fenced code block, wrapping any selection
const codeBlock: Transform = (ta, content) => {
  const s   = ta.selectionStart, e = ta.selectionEnd;
  const sel = content.slice(s, e);
  const before  = content.slice(0, s);
  const nl      = before.length > 0 && !before.endsWith('\n') ? '\n' : '';
  const block   = nl + '```\n' + sel + '\n```\n';
  return {
    content:  before + block + content.slice(e),
    selStart: s + nl.length + 4,
    selEnd:   s + nl.length + 4 + sel.length,
  };
};

// Insert a horizontal rule
const hr: Transform = (ta, content) => {
  const s    = ta.selectionStart;
  const before = content.slice(0, s);
  const nl   = before.length > 0 && !before.endsWith('\n') ? '\n' : '';
  const rule = nl + '---\n';
  return {
    content:  before + rule + content.slice(s),
    selStart: s + rule.length,
    selEnd:   s + rule.length,
  };
};

type Button = { icon: React.ReactNode; title: string; transform: Transform };

const GROUPS: Button[][] = [
  [
    { icon: <Heading1 size={14} />, title: 'Heading 1',   transform: heading('# ')   },
    { icon: <Heading2 size={14} />, title: 'Heading 2',   transform: heading('## ')  },
    { icon: <Heading3 size={14} />, title: 'Heading 3',   transform: heading('### ') },
  ],
  [
    { icon: <Bold         size={14} />, title: 'Bold',          transform: inline('**', '**', 'bold text')       },
    { icon: <Italic       size={14} />, title: 'Italic',        transform: inline('*',  '*',  'italic text')     },
    { icon: <Strikethrough size={14}/>, title: 'Strikethrough', transform: inline('~~', '~~', 'strikethrough')   },
    { icon: <Code         size={14} />, title: 'Inline code',   transform: inline('`',  '`',  'code')            },
  ],
  [
    { icon: <Quote       size={14} />, title: 'Blockquote',    transform: linePrefix('> ')  },
    { icon: <List        size={14} />, title: 'Bullet list',   transform: linePrefix('- ')  },
    { icon: <ListOrdered size={14} />, title: 'Numbered list', transform: linePrefix('1. ') },
  ],
  [
    { icon: <Link  size={14} />, title: 'Link',       transform: inline('[', '](url)', 'link text') },
    { icon: <Image size={14} />, title: 'Image',      transform: inline('![', '](url)', 'alt text') },
    { icon: <Code2 size={14} />, title: 'Code block', transform: codeBlock                         },
    { icon: <Minus size={14} />, title: 'Horizontal rule', transform: hr                           },
  ],
];

interface Props {
  onAction: (transform: Transform) => void;
}

export function EditorToolbar({ onAction }: Props) {
  return (
    <div className="editor-toolbar">
      {GROUPS.map((group, gi) => (
        <div key={gi} className="editor-toolbar-group">
          {group.map(({ icon, title, transform }) => (
            <button
              key={title}
              className="btn btn-icon editor-toolbar-btn"
              title={title}
              onMouseDown={(e) => { e.preventDefault(); onAction(transform); }}
            >
              {icon}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
