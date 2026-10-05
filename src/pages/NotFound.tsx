import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Home, MapPin } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <Layout>
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl accent-gradient flex items-center justify-center mx-auto mb-5 shadow-card">
            <MapPin className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-display text-4xl font-bold text-foreground mb-2">404</h1>
          <p className="text-muted-foreground mb-6">
            Página não encontrada. O endereço que você acessou não existe ou foi movido.
          </p>
          <Button variant="gold" asChild>
            <Link to="/">
              <Home className="w-4 h-4 mr-2" />
              Voltar ao Início
            </Link>
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default NotFound;
