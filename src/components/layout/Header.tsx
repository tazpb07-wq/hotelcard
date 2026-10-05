import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, Home, Building2, Phone, LogOut, Shield } from "lucide-react";
import anime from "animejs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { prefersReducedMotion } from "@/lib/animations";

const navItems = [
  { label: "Início", href: "/", icon: Home },
  { label: "Imóveis", href: "/produtos", icon: Building2 },
  { label: "Contato", href: "/contato", icon: Phone },
];

export function Header({ locked = false }: { locked?: boolean }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const mobileNavRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const { user, signOut, loading } = useAuth();
  const { isAdmin } = useUserRole();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!isMenuOpen || !mobileNavRef.current || prefersReducedMotion()) return;
    anime({
      targets: mobileNavRef.current.querySelectorAll(".mobile-nav-item"),
      opacity: [0, 1],
      translateX: [-16, 0],
      duration: 350,
      delay: anime.stagger(60),
      easing: "easeOutQuart",
    });
  }, [isMenuOpen]);

  const handleSignOut = async () => {
    await signOut();
    setIsMenuOpen(false);
  };

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 glass-header border-b border-border/70 transition-shadow duration-300",
        scrolled ? "shadow-card" : "shadow-soft"
      )}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          {locked ? (
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl accent-gradient flex items-center justify-center shadow-sm">
                <Building2 className="w-6 h-6 text-accent-foreground" />
              </div>
              <div>
                <span className="font-display text-lg sm:text-xl font-bold text-foreground leading-none tracking-tight">DF Imóveis</span>
                <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mt-1">CRECI 6539</span>
              </div>
            </div>
          ) : (
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl accent-gradient flex items-center justify-center shadow-sm">
              <Building2 className="w-6 h-6 text-accent-foreground" />
            </div>
            <div>
              <span className="font-display text-lg sm:text-xl font-bold text-foreground leading-none tracking-tight">DF Imóveis</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mt-1">CRECI 6539</span>
            </div>
          </Link>
          )}

          {/* Desktop Navigation */}
          <nav className={cn("hidden md:flex items-center gap-8", locked && "invisible")}>
            {navItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "relative text-sm font-medium tracking-wide transition-colors py-2 hover:text-primary",
                  "after:absolute after:bottom-0 after:left-0 after:h-[2px] after:rounded-full after:bg-primary after:transition-all after:duration-300",
                  location.pathname === item.href
                    ? "text-foreground after:w-full"
                    : "text-muted-foreground after:w-0 hover:after:w-full"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Desktop Auth Buttons */}
          <div className="hidden md:flex items-center gap-3">
            {!loading && user && (
              <>
                {isAdmin && (
                  <Button variant="gold" size="sm" asChild>
                    <Link to="/admin">
                      <Shield className="w-4 h-4 mr-2" />
                      Admin
                    </Link>
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleSignOut}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair
                </Button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className={cn(
              "md:hidden w-11 h-11 flex items-center justify-center rounded-lg text-foreground hover:bg-muted transition-colors",
              locked && "invisible pointer-events-none"
            )}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Abrir menu"
          >
            {isMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div ref={mobileNavRef} className="md:hidden py-3 border-t border-border/70">
            <nav className="flex flex-col gap-1.5">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "mobile-nav-item flex items-center gap-3 px-4 py-3.5 rounded-xl transition-colors",
                    location.pathname === item.href
                      ? "bg-primary/10 text-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                  onClick={() => setIsMenuOpen(false)}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              ))}
              {!loading && user && (
                <div className="border-t border-border mt-1.5 pt-3 flex flex-col gap-1.5 px-1">
                  {isAdmin && (
                    <Button variant="gold" asChild className="mobile-nav-item justify-start">
                      <Link to="/admin" onClick={() => setIsMenuOpen(false)}>
                        <Shield className="w-4 h-4 mr-2" />
                        Admin
                      </Link>
                    </Button>
                  )}
                  <Button variant="ghost" onClick={handleSignOut} className="mobile-nav-item justify-start">
                    <LogOut className="w-4 h-4 mr-2" />
                    Sair
                  </Button>
                </div>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
