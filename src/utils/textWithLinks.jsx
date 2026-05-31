import React, { useMemo } from 'react';

function markdownLinkRegex() {
  return /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeHtmlAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function isSafeHttpUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Parse `[label](https://…)` into React nodes (no innerHTML). */
export function parseMarkdownLinks(text) {
  const str = String(text || '');
  if (!str) return [];

  const parts = [];
  let lastIndex = 0;
  let linkIndex = 0;
  const re = markdownLinkRegex();

  for (const match of str.matchAll(re)) {
    const [full, label, url] = match;
    const index = match.index ?? 0;

    if (!isSafeHttpUrl(url)) {
      continue;
    }

    if (index > lastIndex) {
      parts.push(str.slice(lastIndex, index));
    }

    parts.push(
      <a
        key={`md-link-${linkIndex}`}
        href={url}
        target="_blank"
        rel="noreferrer noopener"
        className="text-with-links__a"
      >
        {label}
      </a>
    );

    linkIndex += 1;
    lastIndex = index + full.length;
  }

  if (parts.length === 0) {
    return [str];
  }

  if (lastIndex < str.length) {
    parts.push(str.slice(lastIndex));
  }

  return parts;
}

/** Plain text for title attributes and other non-HTML contexts. */
export function stripMarkdownLinks(text) {
  return String(text || '').replace(markdownLinkRegex(), '$1');
}

/** Renders `[label](url)` segments as external links — React nodes only, no innerHTML. */
export function TextWithLinks({ text, className }) {
  const parts = useMemo(() => parseMarkdownLinks(text), [text]);
  if (!parts.length) return null;

  return (
    <span
      className={className}
      onMouseDown={(e) => {
        if (e.target.closest('a')) {
          e.stopPropagation();
        }
      }}
      onClick={(e) => {
        if (e.target.closest('a')) {
          e.stopPropagation();
        }
      }}
    >
      {parts}
    </span>
  );
}
