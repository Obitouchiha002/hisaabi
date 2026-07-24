import { useRef, useState, type ReactNode } from 'react';
import { useT } from '@/lib/i18n';

/**
 * Entry ko baayen swipe karke hatao.
 *
 * Delete pehle sirf entry kholne ke baad sheet me tha — kisi ko mila hi nahi.
 * Phone pe swipe wahi harkat hai jo log Gmail/WhatsApp me pehle se karte hain,
 * isliye alag se sikhana nahi padta.
 *
 * preventDefault yahan kaam nahi karta (React ke touch listener passive hote
 * hain), isliye CSS me `touch-action: pan-y` lagaya hai — upar-neeche scroll
 * browser karega, daayen-baayen hum.
 */
export function SwipeRow({
  onDelete,
  label,
  children,
}: {
  onDelete(): void;
  label?: string;
  children: ReactNode;
}) {
  const t = useT();
  const removeLabel = label ?? t('Remove', 'Hatao');
  const [dx, setDx] = useState(0);
  const [going, setGoing] = useState(false);
  const start = useRef<{ x: number; y: number; axis: 'none' | 'x' | 'y' } | null>(null);
  /* dx sirf state me rakhne se touchend purani value padh leta hai —
     do move ek hi frame me aa jayen to React beech me render nahi karta. */
  const dxRef = useRef(0);

  const THRESHOLD = 88;   // itna kheencha to delete

  function move(next: number) {
    dxRef.current = next;
    setDx(next);
  }

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]!;
    start.current = { x: t.clientX, y: t.clientY, axis: 'none' };
  }

  function onTouchMove(e: React.TouchEvent) {
    const s = start.current;
    if (!s) return;
    const t = e.touches[0]!;
    const mx = t.clientX - s.x;
    const my = t.clientY - s.y;

    if (s.axis === 'none') {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      s.axis = Math.abs(mx) > Math.abs(my) ? 'x' : 'y';
    }
    if (s.axis !== 'x') return;

    // sirf baayen; daayen kheenchne pe kuch nahi hota
    move(Math.max(-140, Math.min(0, mx)));
  }

  function onTouchEnd() {
    const s = start.current;
    start.current = null;
    if (!s || s.axis !== 'x') { move(0); return; }

    if (dxRef.current <= -THRESHOLD) {
      setGoing(true);
      move(-window.innerWidth);
      setTimeout(onDelete, 180);
    } else {
      move(0);
    }
  }

  const armed = dx <= -THRESHOLD;

  return (
    <div className="swipe" data-going={going ? '' : undefined}>
      <div className="swipe-back" data-armed={armed ? '' : undefined} aria-hidden="true">
        <span>{removeLabel}</span>
      </div>
      <div
        className="swipe-front"
        style={{ transform: `translateX(${dx}px)`, transition: start.current ? 'none' : 'transform .22s var(--ease-out)' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
