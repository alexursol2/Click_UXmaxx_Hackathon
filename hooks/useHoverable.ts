"use client";

import { useEffect, useState } from "react";

/**
 * True on devices with a real hover (desktop pointers), false on touch. Lets a
 * component open a panel on hover for desktop and on tap for mobile.
 */
export function useHoverable(): boolean {
  const [hoverable, setHoverable] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    setHoverable(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setHoverable(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return hoverable;
}

/**
 * Returns props + state for a "hover on desktop, tap on mobile" disclosure.
 * Spread `triggerProps` onto the element that opens the panel.
 */
export function useHoverTap() {
  const hoverable = useHoverable();
  const [open, setOpen] = useState(false);
  const triggerProps = hoverable
    ? {
        onMouseEnter: () => setOpen(true),
        onMouseLeave: () => setOpen(false),
      }
    : {
        onClick: () => setOpen((v) => !v),
      };
  return { open, setOpen, hoverable, triggerProps };
}
