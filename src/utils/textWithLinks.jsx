import React from 'react';

const MARKDOWN_LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;

/** Plain text for title attributes and other non-HTML contexts. */
export function stripMarkdownLinks(text) {
  return String(text || '').replace(MARKDOWN_LINK_RE, '$1');
}

/** Renders `[label](url)` segments as external links; other text unchanged. */
export function TextWithLinks({ text, className }) {
  const str = String(text || '');
  if (!str) return null;

  const parts = [];
  let lastIndex = 0;
  let linkIndex = 0;

  for (const match of str.matchAll(MARKDOWN_LINK_RE)) {
    const [full, label, url] = match;
    const index = match.index ?? 0;

    if (index > lastIndex) {
      parts.push(str.slice(lastIndex, index));
    }

    parts.push(
      <a
        key={`link-${linkIndex}`}
        href={url}
        target="_blank"
        rel="noreferrer"
        className="text-with-links__a"
        onClick={(e) => e.stopPropagation()}
      >
        {label}
      </a>
    );

    linkIndex += 1;
    lastIndex = index + full.length;
  }

  if (parts.length === 0) {
    return <span className={className}>{str}</span>;
  }

  if (lastIndex < str.length) {
    parts.push(str.slice(lastIndex));
  }

  return <span className={className}>{parts}</span>;
}
