import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function FloatingTooltip({ content, wide, anchorClassName = '', children }) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const anchorRef = useRef(null);

  const show = () => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({
      top: rect.top - 8,
      left: rect.left + rect.width / 2,
    });
    setVisible(true);
  };

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
            className={`floating-tooltip ${wide ? 'floating-tooltip--wide' : ''}`}
            style={{
              top: position.top,
              left: position.left,
              transform: 'translate(-50%, -100%)',
            }}
          >
            {content}
          </div>,
          document.body
        )}
    </>
  );
}
