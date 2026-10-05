import { ReactNode, useEffect, useRef } from "react";
import anime from "animejs";
import { prefersReducedMotion } from "@/lib/animations";
import { cn } from "@/lib/utils";

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  stagger?: boolean;
  staggerDelay?: number;
}

export function Reveal({
  children,
  className,
  delay = 0,
  stagger = false,
  staggerDelay = 50,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const played = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (prefersReducedMotion()) {
      el.style.opacity = "1";
      return;
    }

    const targets = stagger ? Array.from(el.children) : el;
    anime.set(targets, { opacity: 0, translateY: 24 });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !played.current) {
            played.current = true;
            anime({
              targets,
              opacity: [0, 1],
              translateY: [24, 0],
              duration: 450,
              delay: stagger ? anime.stagger(staggerDelay, { start: delay }) : delay,
              easing: "easeOutQuart",
            });
            observer.disconnect();
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [delay, stagger, staggerDelay]);

  return (
    <div ref={ref} className={cn("will-change-transform", className)}>
      {children}
    </div>
  );
}
