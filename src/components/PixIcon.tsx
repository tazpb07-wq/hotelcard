import pixLogo from "@/assets/pix-logo.png";

// Official Pix logo on a rounded white chip — used in admin action buttons
export const PixIcon = ({ className }: { className?: string }) => (
  <span
    className={`inline-flex items-center justify-center rounded-md bg-white p-[3px] flex-shrink-0 ${className ?? ""}`}
    aria-hidden="true"
  >
    <img src={pixLogo} alt="" className="w-full h-full object-contain" />
  </span>
);
