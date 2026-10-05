import anime from "animejs";

export const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const fadeInUp = (
  targets: anime.AnimeParams["targets"],
  options?: Partial<anime.AnimeParams>
) => {
  if (prefersReducedMotion()) {
    anime.set(targets, { opacity: 1, translateY: 0 });
    return;
  }
  return anime({
    targets,
    opacity: [0, 1],
    translateY: [24, 0],
    duration: 600,
    easing: "easeOutCubic",
    ...options,
  });
};

export const staggerIn = (
  targets: anime.AnimeParams["targets"],
  options?: Partial<anime.AnimeParams>
) => {
  if (prefersReducedMotion()) {
    anime.set(targets, { opacity: 1, translateY: 0 });
    return;
  }
  return anime({
    targets,
    opacity: [0, 1],
    translateY: [28, 0],
    scale: [0.97, 1],
    duration: 550,
    delay: anime.stagger(80),
    easing: "easeOutQuart",
    ...options,
  });
};

export const pulse = (
  targets: anime.AnimeParams["targets"],
  options?: Partial<anime.AnimeParams>
) => {
  if (prefersReducedMotion()) return;
  return anime({
    targets,
    scale: [1, 1.08, 1],
    duration: 2000,
    easing: "easeInOutSine",
    loop: true,
    ...options,
  });
};
