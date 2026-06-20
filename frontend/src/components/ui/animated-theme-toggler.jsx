"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { flushSync } from 'react-dom';

const TRANSITION_VARIANTS = [
  'circle',
  'square',
  'triangle',
  'diamond',
  'hexagon',
  'rectangle',
  'star',
];

function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

function polygonCollapsed(cx, cy, vertexCount) {
  const pairs = Array.from(
    { length: vertexCount },
    () => `${cx}px ${cy}px`
  ).join(', ');
  return `polygon(${pairs})`;
}

function getThemeTransitionClipPaths(
  variant,
  cx,
  cy,
  maxRadius,
  viewportWidth,
  viewportHeight
) {
  switch (variant) {
    case 'circle':
      return [
        `circle(0px at ${cx}px ${cy}px)`,
        `circle(${maxRadius}px at ${cx}px ${cy}px)`,
      ];
    case 'square': {
      const halfW = Math.max(cx, viewportWidth - cx);
      const halfH = Math.max(cy, viewportHeight - cy);
      const halfSide = Math.max(halfW, halfH) * 1.05;
      const end = [
        `${cx - halfSide}px ${cy - halfSide}px`,
        `${cx + halfSide}px ${cy - halfSide}px`,
        `${cx + halfSide}px ${cy + halfSide}px`,
        `${cx - halfSide}px ${cy + halfSide}px`,
      ].join(', ');
      return [polygonCollapsed(cx, cy, 4), `polygon(${end})`];
    }
    case 'triangle': {
      const scale = maxRadius * 2.2;
      const dx = (Math.sqrt(3) / 2) * scale;
      const verts = [
        `${cx}px ${cy - scale}px`,
        `${cx + dx}px ${cy + 0.5 * scale}px`,
        `${cx - dx}px ${cy + 0.5 * scale}px`,
      ].join(', ');
      return [polygonCollapsed(cx, cy, 3), `polygon(${verts})`];
    }
    case 'diamond': {
      const radius = maxRadius * Math.SQRT2;
      const end = [
        `${cx}px ${cy - radius}px`,
        `${cx + radius}px ${cy}px`,
        `${cx}px ${cy + radius}px`,
        `${cx - radius}px ${cy}px`,
      ].join(', ');
      return [polygonCollapsed(cx, cy, 4), `polygon(${end})`];
    }
    case 'hexagon': {
      const radius = maxRadius * Math.SQRT2;
      const verts = [];
      for (let i = 0; i < 6; i += 1) {
        const angle = -Math.PI / 2 + (i * Math.PI) / 3;
        verts.push(`${cx + radius * Math.cos(angle)}px ${cy + radius * Math.sin(angle)}px`);
      }
      return [polygonCollapsed(cx, cy, 6), `polygon(${verts.join(', ')})`];
    }
    case 'rectangle': {
      const halfW = Math.max(cx, viewportWidth - cx);
      const halfH = Math.max(cy, viewportHeight - cy);
      const end = [
        `${cx - halfW}px ${cy - halfH}px`,
        `${cx + halfW}px ${cy - halfH}px`,
        `${cx + halfW}px ${cy + halfH}px`,
        `${cx - halfW}px ${cy + halfH}px`,
      ].join(', ');
      return [polygonCollapsed(cx, cy, 4), `polygon(${end})`];
    }
    case 'star': {
      const radius = maxRadius * Math.SQRT2 * 1.03;
      const innerRatio = 0.42;
      const starPolygon = (nextRadius) => {
        const verts = [];
        for (let i = 0; i < 5; i += 1) {
          const outerAngle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
          verts.push(`${cx + nextRadius * Math.cos(outerAngle)}px ${cy + nextRadius * Math.sin(outerAngle)}px`);
          const innerAngle = outerAngle + Math.PI / 5;
          verts.push(`${cx + nextRadius * innerRatio * Math.cos(innerAngle)}px ${cy + nextRadius * innerRatio * Math.sin(innerAngle)}px`);
        }
        return `polygon(${verts.join(', ')})`;
      };
      const startRadius = Math.max(2, radius * 0.025);
      return [starPolygon(startRadius), starPolygon(radius)];
    }
    default:
      return [
        `circle(0px at ${cx}px ${cy}px)`,
        `circle(${maxRadius}px at ${cx}px ${cy}px)`,
      ];
  }
}

export const AnimatedThemeToggler = ({
  className,
  duration = 400,
  variant,
  fromCenter = false,
  theme,
  onThemeChange,
  ...props
}) => {
  const shape = TRANSITION_VARIANTS.includes(variant) ? variant : 'circle';
  const isControlled = theme !== undefined;
  const [internalIsDark, setInternalIsDark] = useState(false);
  const isDark = isControlled ? theme === 'dark' : internalIsDark;
  const buttonRef = useRef(null);

  useEffect(() => {
    if (isControlled) return undefined;
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme === 'dark' || storedTheme === 'light') {
      document.documentElement.classList.toggle('dark', storedTheme === 'dark');
    }
    const updateTheme = () => {
      setInternalIsDark(document.documentElement.classList.contains('dark'));
    };
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, [isControlled]);

  const toggleTheme = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;

    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    let x;
    let y;

    if (fromCenter) {
      x = viewportWidth / 2;
      y = viewportHeight / 2;
    } else {
      const { top, left, width, height } = button.getBoundingClientRect();
      x = left + width / 2;
      y = top + height / 2;
    }

    const maxRadius = Math.hypot(
      Math.max(x, viewportWidth - x),
      Math.max(y, viewportHeight - y)
    );

    const applyTheme = () => {
      const newTheme = !isDark;
      document.documentElement.classList.toggle('dark');
      if (isControlled) {
        onThemeChange?.(newTheme ? 'dark' : 'light');
      } else {
        setInternalIsDark(newTheme);
        localStorage.setItem('theme', newTheme ? 'dark' : 'light');
      }
    };

    if (typeof document.startViewTransition !== 'function') {
      applyTheme();
      return;
    }

    const clipPath = getThemeTransitionClipPaths(
      shape,
      x,
      y,
      maxRadius,
      viewportWidth,
      viewportHeight
    );
    const root = document.documentElement;
    root.dataset.magicuiThemeVt = 'active';
    root.style.setProperty('--magicui-theme-toggle-vt-duration', `${duration}ms`);
    root.style.setProperty('--magicui-theme-vt-clip-from', clipPath[0]);

    const cleanup = () => {
      delete root.dataset.magicuiThemeVt;
      root.style.removeProperty('--magicui-theme-toggle-vt-duration');
      root.style.removeProperty('--magicui-theme-vt-clip-from');
    };

    const transition = document.startViewTransition(() => {
      flushSync(applyTheme);
    });

    if (typeof transition?.finished?.finally === 'function') {
      transition.finished.finally(cleanup);
    } else {
      cleanup();
    }

    const ready = transition?.ready;
    if (ready && typeof ready.then === 'function') {
      ready.then(() => {
        document.documentElement.animate(
          {
            clipPath,
          },
          {
            duration,
            easing: shape === 'star' ? 'linear' : 'ease-in-out',
            fill: 'forwards',
            pseudoElement: '::view-transition-new(root)',
          }
        );
      });
    }
  }, [shape, fromCenter, duration, isDark, isControlled, onThemeChange]);

  return (
    <button
      type="button"
      ref={buttonRef}
      onClick={toggleTheme}
      className={cn(className)}
      {...props}
    >
      {isDark ? <Sun /> : <Moon />}
      <span className="sr-only">Toggle theme</span>
    </button>
  );
};

export default AnimatedThemeToggler;
