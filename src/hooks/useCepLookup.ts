import { useState, useCallback } from "react";
import { maskCEP } from "@/lib/masks";

interface CepData {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

interface UseCepLookupReturn {
  cepData: CepData | null;
  isFetchingCep: boolean;
  handleCepChange: (value: string, onMasked?: (masked: string) => void) => Promise<string>;
  resetCepData: () => void;
}

export function useCepLookup(): UseCepLookupReturn {
  const [cepData, setCepData] = useState<CepData | null>(null);
  const [isFetchingCep, setIsFetchingCep] = useState(false);

  const handleCepChange = useCallback(async (value: string, onMasked?: (masked: string) => void): Promise<string> => {
    const masked = maskCEP(value);
    onMasked?.(masked);

    const cleaned = masked.replace(/\D/g, "");
    if (cleaned.length === 8) {
      setIsFetchingCep(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`);
        const json = await res.json();
        if (!json.erro) {
          const data: CepData = {
            street: json.logradouro || "",
            neighborhood: json.bairro || "",
            city: json.localidade || "",
            state: json.uf || "",
          };
          setCepData(data);
          return masked;
        }
      } catch {
        // silent fail
      } finally {
        setIsFetchingCep(false);
      }
    } else {
      setCepData(null);
    }

    return masked;
  }, []);

  const resetCepData = useCallback(() => setCepData(null), []);

  return { cepData, isFetchingCep, handleCepChange, resetCepData };
}
