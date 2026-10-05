import { useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import anime from "animejs";
import { prefersReducedMotion } from "@/lib/animations";

interface ImageLightboxProps {
  images: string[];
  initialIndex?: number;
  onClose: () => void;
}

const ZOOM_LEVELS = [1, 1.5, 2, 3];

export function ImageLightbox({ images, initialIndex = 0, onClose }: ImageLightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const overlayRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

  const prev = () => {
    setIndex((i) => (i - 1 + images.length) % images.length);
    setZoom(1);
  };
  const next = () => {
    setIndex((i) => (i + 1) % images.length);
    setZoom(1);
  };

  const zoomIn = () => setZoom((z) => ZOOM_LEVELS[Math.min(ZOOM_LEVELS.indexOf(z) + 1, ZOOM_LEVELS.length - 1)] ?? z);
  const zoomOut = () => setZoom((z) => ZOOM_LEVELS[Math.max(ZOOM_LEVELS.indexOf(z) - 1, 0)] ?? z);

  useEffect(() => {
    if (!overlayRef.current || prefersReducedMotion()) return;
    anime({
      targets: overlayRef.current,
      opacity: [0, 1],
      duration: 250,
      easing: "easeOutQuad",
    });
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") {
        setIndex((i) => (i - 1 + images.length) % images.length);
        setZoom(1);
      }
      if (e.key === "ArrowRight") {
        setIndex((i) => (i + 1) % images.length);
        setZoom(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [images.length, onClose]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || zoom > 1) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) {
      if (dx > 0) prev(); else next();
    }
    touchStartX.current = null;
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col"
      onClick={onClose}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 py-3"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-white/80 text-sm font-medium">
          {index + 1} / {images.length}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={zoomOut}
            disabled={zoom === 1}
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors disabled:opacity-40"
            aria-label="Diminuir zoom"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <button
            onClick={zoomIn}
            disabled={zoom === ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors disabled:opacity-40"
            aria-label="Aumentar zoom"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            aria-label="Fechar galeria"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Image */}
      <div
        className="flex-1 flex items-center justify-center px-2 overflow-auto"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <img
          src={images[index]}
          alt={`Foto ${index + 1}`}
          draggable={false}
          className="object-contain transition-transform duration-300 select-none"
          style={{
            transform: `scale(${zoom})`,
            maxHeight: zoom === 1 ? "100%" : "none",
            maxWidth: zoom === 1 ? "100%" : "none",
          }}
        />
      </div>

      {/* Bottom nav */}
      {images.length > 1 && (
        <div
          className="flex items-center justify-between px-4 py-4"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={prev}
            className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            aria-label="Foto anterior"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => { setIndex(i); setZoom(1); }}
                className={`h-2 rounded-full transition-all ${
                  i === index ? "bg-white w-5" : "bg-white/40 w-2"
                }`}
                aria-label={`Foto ${i + 1}`}
              />
            ))}
          </div>
          <button
            onClick={next}
            className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            aria-label="Próxima foto"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      )}
    </div>
  );
}
