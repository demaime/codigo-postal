"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Marca `true` la primera vez que el elemento se acerca al viewport, y deja de
 * observar. Se usa para montar los mapas de a poco: antes se instanciaban los
 * 20 de una y bajaban tiles todos juntos.
 */
export function useInView<T extends Element>(rootMargin = "250px") {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (inView) return;

    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [inView, rootMargin]);

  return { ref, inView };
}
