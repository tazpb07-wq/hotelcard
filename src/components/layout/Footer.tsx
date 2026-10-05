import { Link } from "react-router-dom";
import { Building2, Phone, Mail, MapPin } from "lucide-react";

export function Footer({ locked = false }: { locked?: boolean }) {
  return (
    <footer className="bg-foreground text-background">
      <div className="container mx-auto px-4 py-8 md:py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between md:gap-10">
          {/* Brand */}
          <div className="md:max-w-[260px]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg accent-gradient flex items-center justify-center shadow-sm">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-display text-lg font-bold leading-none tracking-tight">DF Imóveis</span>
                <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-background/50 mt-1">CRECI 6539</span>
              </div>
            </div>
            <p className="text-background/60 text-sm leading-relaxed mt-3">
              Flats e apartamentos selecionados para sua hospedagem em João Pessoa.
            </p>
          </div>

          {/* Nav — hidden while the guest is locked on the reservation page */}
          {!locked && (
          <nav className="flex items-center gap-6 md:flex-col md:items-start md:gap-2.5">
            <Link to="/" className="text-background/60 hover:text-background transition-colors text-sm">
              Início
            </Link>
            <Link to="/produtos" className="text-background/60 hover:text-background transition-colors text-sm">
              Imóveis
            </Link>
            <Link to="/contato" className="text-background/60 hover:text-background transition-colors text-sm">
              Contato
            </Link>
          </nav>
          )}

          {/* Contact */}
          <div className="flex flex-col gap-2.5">
            <a
              href="tel:+5583987344520"
              className="flex items-center gap-2.5 text-background/60 hover:text-background transition-colors text-sm"
            >
              <Phone className="w-4 h-4 flex-shrink-0 text-primary" />
              <span className="whitespace-nowrap">(83) 9 8734-4520</span>
            </a>
            <a
              href="mailto:contato@dfimoveis.com.br"
              className="flex items-center gap-2.5 text-background/60 hover:text-background transition-colors text-sm"
            >
              <Mail className="w-4 h-4 flex-shrink-0 text-primary" />
              <span>contato@dfimoveis.com.br</span>
            </a>
            <div className="flex items-center gap-2.5 text-background/60 text-sm">
              <MapPin className="w-4 h-4 flex-shrink-0 text-primary" />
              <span>João Pessoa, Paraíba</span>
            </div>
          </div>

        </div>

        {/* Bottom bar */}
        <div className="border-t border-background/10 mt-7 pt-4 flex flex-col sm:flex-row items-center justify-between gap-1 text-xs text-background/50">
          <p>© {new Date().getFullYear()} DF Imóveis. Todos os direitos reservados.</p>
          <p>Daniel Ferreira | CRECI 6539</p>
        </div>
      </div>
    </footer>
  );
}
