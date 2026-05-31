import { useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

const VIEWPORT_MARGIN = 10;

function computeTooltipStyle(anchorRect, tooltipRect) {
  const anchorCenterX = anchorRect.left + anchorRect.width / 2;
  const spaceAbove = anchorRect.top - VIEWPORT_MARGIN;
  const spaceBelow = window.innerHeight - anchorRect.bottom - VIEWPORT_MARGIN;
  const preferAbove = spaceAbove >= tooltipRect.height || spaceAbove >= spaceBelow;

  let top;
  let transform;

  if (preferAbove) {
    top = anchorRect.top - 8;
    transform = 'translate(-50%, -100%)';
  } else {
    top = anchorRect.bottom + 8;
    transform = 'translate(-50%, 0)';
  }

  let left = anchorCenterX;
  const halfWidth = tooltipRect.width / 2;
  const minLeft = VIEWPORT_MARGIN + halfWidth;
  const maxLeft = window.innerWidth - VIEWPORT_MARGIN - halfWidth;

  if (left < minLeft) left = minLeft;
  if (left > maxLeft) left = maxLeft;

  if (preferAbove) {
    const tooltipTop = top - tooltipRect.height;
    if (tooltipTop < VIEWPORT_MARGIN) {
      top = VIEWPORT_MARGIN + tooltipRect.height;
    }
  } else if (top + tooltipRect.height > window.innerHeight - VIEWPORT_MARGIN) {
    top = window.innerHeight - VIEWPORT_MARGIN - tooltipRect.height;
  }

  return { top, left, transform };
}

export default function FloatingTooltip({ content, wide, anchorClassName = '', children }) {
  const [visible, setVisible] = useState(false);
  const [style, setStyle] = useState({ top: 0, left: 0, transform: 'translate(-50%, -100%)' });
  const anchorRef = useRef(null);
  const tooltipRef = useRef(null);

  const reposition = () => {
    const anchorRect = anchorRef.current?.getBoundingClientRect();
    const tooltipRect = tooltipRef.current?.getBoundingClientRect();
    if (!anchorRect || !tooltipRect?.width) return;
    setStyle(computeTooltipStyle(anchorRect, tooltipRect));
  };

  const show = () => {
    setVisible(true);
  };

  useLayoutEffect(() => {
    if (!visible) return;

    reposition();
    const frame = requestAnimationFrame(reposition);

    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [visible, wide]);

  return (
    <>
      <div
        ref={anchorRef}
        className={`floating-tooltip-anchor ${anchorClassName}`}
        onMouseEnter={show}
        onMouseLeave={() => setVisible(false)}
      >
        {children}
      </div>
      {visible &&
        createPortal(
          <div
            ref={tooltipRef}
            className={`floating-tooltip ${wide ? 'floating-tooltip--wide' : ''}`}
            style={{
              top: style.top,
              left: style.left,
              transform: style.transform,
              visibility: style.top === 0 && style.left === 0 ? 'hidden' : 'visible',
            }}
          >
            {content}
          </div>,
          document.body
        )}
    </>
  );
}
