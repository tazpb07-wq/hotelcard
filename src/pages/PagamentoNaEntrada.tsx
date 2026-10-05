import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  User,
  MapPin,
  Upload,
  CheckCircle,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Building2,
  Camera,
  Image as ImageIcon,
  FileText,
  Calendar,
  CreditCard,
} from "lucide-react";
import { maskCPF, maskCEP } from "@/lib/masks";
import { useCepLookup } from "@/hooks/useCepLookup";
import { supabase } from "@/integrations/supabase/client";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface PersonalData {
  full_name: string;
  cpf: string;
  birth_date: string;
  street: string;
  street_number: string;
  cep: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  device_os: string;
  device_brand: string;
}

interface DocumentFiles {
  doc_front: File | null;
  doc_back: File | null;
  selfie: File | null;
}

interface Submission {
  id: string;
  status: string;
  full_name: string | null;
  cpf: string | null;
  birth_date: string | null;
  street: string | null;
  street_number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  cep: string | null;
  doc_front_url: string | null;
  doc_back_url: string | null;
  selfie_url: string | null;
  terms_accepted: boolean;
  created_at: string;
}

// ─────────────────────────────────────────────
// Steps
// ─────────────────────────────────────────────
const steps = [
  { label: "Dados Pessoais", icon: User },
  { label: "Documentos", icon: Upload },
];

// ─────────────────────────────────────────────
// FileUploadButton
// ─────────────────────────────────────────────
interface FileUploadButtonProps {
  fieldKey: keyof DocumentFiles;
  label: string;
  desc: string;
  file: File | null;
  preview?: string;
  onSelect: (field: keyof DocumentFiles, file: File | null) => void;
}

const FileUploadButton = ({ fieldKey, label, desc, file, preview, onSelect }: FileUploadButtonProps) => {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, ref: React.RefObject<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    onSelect(fieldKey, f);
    if (ref.current) ref.current.value = "";
  };

  return (
    <div>
      <Label className="text-sm font-medium">{label}</Label>
      <p className="text-xs text-muted-foreground mb-3">{desc}</p>

      {preview ? (
        <div className="relative mb-3">
          <img src={preview} alt={label} className="w-full max-h-48 object-cover rounded-xl border border-border" />
          <div className="absolute top-2 right-2">
            <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Selecionado
            </span>
          </div>
        </div>
      ) : (
        <div className="border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center justify-center text-muted-foreground mb-3">
          <Upload className="w-8 h-8 mb-2 opacity-50" />
          <span className="text-sm">Nenhuma foto selecionada</span>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-2 border border-border rounded-lg py-2.5 px-3 text-sm font-medium hover:bg-muted transition-colors"
        >
          <Camera className="w-4 h-4 text-primary" />
          Câmera
        </button>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleChange(e, cameraRef)} />

        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-2 border border-border rounded-lg py-2.5 px-3 text-sm font-medium hover:bg-muted transition-colors"
        >
          <ImageIcon className="w-4 h-4 text-primary" />
          Galeria
        </button>
        <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={e => handleChange(e, galleryRef)} />
      </div>

      {file && <p className="text-xs text-muted-foreground mt-1 truncate">{file.name}</p>}
    </div>
  );
};

// ─────────────────────────────────────────────
// Success screen (after submit)
// ─────────────────────────────────────────────
const SuccessScreen = () => {
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    if (countdown <= 0) {
      window.location.href = "/";
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  return (
    <div className="min-h-screen bg-secondary flex items-center justify-center px-4">
      <div className="bg-card rounded-2xl p-6 md:p-8 max-w-md w-full text-center shadow-lg flex flex-col items-center gap-4">
        <CheckCircle className="w-16 h-16 text-green-500" />
        <h1 className="font-display text-2xl font-bold text-foreground">Enviado com sucesso!</h1>
        <p className="text-muted-foreground">
          Seus dados foram recebidos e serão analisados pela nossa equipe. Entraremos em contato em breve.
        </p>
        <p className="text-sm text-muted-foreground">
          Redirecionando em <span className="font-semibold text-foreground">{countdown}s</span>…
        </p>
        <Button
          className="w-full mt-2"
          onClick={() => { window.location.href = "/"; }}
        >
          Voltar ao site agora
        </Button>
      </div>
    </div>
  );
};

// Submitted view
// ─────────────────────────────────────────────
const SubmittedView = ({ submission }: { submission: Submission }) => {
  const statusMap: Record<string, { label: string; color: string }> = {
    pendente: { label: "Aguardando análise", color: "bg-yellow-100 text-yellow-700" },
    enviado: { label: "Enviado", color: "bg-blue-100 text-blue-700" },
    aprovado: { label: "Aprovado ✅", color: "bg-green-100 text-green-700" },
  };
  const st = statusMap[submission.status] || statusMap.pendente;

  const openDoc = async (path: string) => {
    const { data } = await supabase.storage.from("kyc-documents").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("Não foi possível abrir o documento");
  };

  return (
    <div className="min-h-screen bg-secondary py-6 px-4 md:py-8">
      <div className="max-w-2xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
            <Building2 className="w-6 h-6 text-accent-foreground" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">Pagamento na Entrada</h1>
            <p className="text-xs text-muted-foreground">Informações já enviadas</p>
          </div>
        </div>

        {/* Status banner */}
        <div className="bg-card rounded-2xl p-5 shadow-sm text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <h2 className="font-display text-xl font-bold text-foreground mb-1">Dados já enviados!</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Suas informações foram enviadas em {new Date(submission.created_at).toLocaleString("pt-BR")}.
          </p>
          <span className={`inline-block text-xs font-medium px-3 py-1 rounded-full ${st.color}`}>{st.label}</span>
        </div>

        {/* Analysis status card */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-sm flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="font-semibold text-amber-800 text-base">Em análise pela nossa equipe</span>
          </div>
          <p className="text-sm text-amber-700">
            Seus dados estão sendo analisados. Assim que concluído, você receberá a confirmação. Aguarde a liberação.
          </p>
          <button
            onClick={() => {
              const msg = encodeURIComponent("Olá! Gostaria de saber o andamento do meu pedido de Pagamento na Entrada. Poderia me informar?");
              window.open(`https://wa.me/5583987344520?text=${msg}`, "_blank");
            }}
            className="mt-1 flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium text-sm px-5 py-2.5 rounded-xl transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.556 4.112 1.528 5.836L.057 23.776a.75.75 0 0 0 .916.916l5.94-1.471A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.75 9.75 0 0 1-4.93-1.34l-.353-.21-3.665.908.927-3.577-.23-.37A9.75 9.75 0 1 1 12 21.75z"/>
            </svg>
            Perguntar andamento no WhatsApp
          </button>
        </div>

        {/* Personal data */}
        <div className="bg-card rounded-2xl p-5 shadow-sm">
          <h3 className="font-semibold flex items-center gap-2 mb-4 text-foreground">
            <User className="w-4 h-4 text-primary" /> Dados Pessoais
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Nome Completo</p>
              <p className="font-medium">{submission.full_name || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">CPF</p>
              <p className="font-medium">{submission.cpf || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs flex items-center gap-1"><Calendar className="w-3 h-3" /> Data de Nascimento</p>
              <p className="font-medium">
                {submission.birth_date ? new Date(submission.birth_date + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="bg-card rounded-2xl p-5 shadow-sm">
          <h3 className="font-semibold flex items-center gap-2 mb-4 text-foreground">
            <MapPin className="w-4 h-4 text-primary" /> Endereço
          </h3>
          <div className="text-sm space-y-1">
            <p className="font-medium">{submission.street}{submission.street_number ? `, ${submission.street_number}` : ""}</p>
            {submission.complement && <p className="text-muted-foreground">{submission.complement}</p>}
            <p className="text-muted-foreground">
              {submission.neighborhood && `${submission.neighborhood} — `}{submission.city}/{submission.state}
            </p>
            <p className="text-muted-foreground">CEP: {submission.cep || "—"}</p>
          </div>
        </div>

        {/* Documents */}
        <div className="bg-card rounded-2xl p-5 shadow-sm">
          <h3 className="font-semibold flex items-center gap-2 mb-4 text-foreground">
            <FileText className="w-4 h-4 text-primary" /> Documentos Enviados
          </h3>
          <div className="flex flex-wrap gap-3">
            {submission.doc_front_url ? (
              <button
                onClick={() => openDoc(submission.doc_front_url!)}
                className="flex items-center gap-2 border border-border rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
              >
                <CheckCircle className="w-4 h-4 text-green-500" /> Frente do Documento
              </button>
            ) : (
              <span className="flex items-center gap-2 text-sm text-muted-foreground px-4 py-2.5 border border-dashed border-border rounded-lg">Frente não enviada</span>
            )}
            {submission.doc_back_url ? (
              <button
                onClick={() => openDoc(submission.doc_back_url!)}
                className="flex items-center gap-2 border border-border rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
              >
                <CheckCircle className="w-4 h-4 text-green-500" /> Verso do Documento
              </button>
            ) : (
              <span className="flex items-center gap-2 text-sm text-muted-foreground px-4 py-2.5 border border-dashed border-border rounded-lg">Verso não enviado</span>
            )}
            {submission.selfie_url ? (
              <button
                onClick={() => openDoc(submission.selfie_url!)}
                className="flex items-center gap-2 border border-border rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
              >
                <CheckCircle className="w-4 h-4 text-green-500" /> Selfie
              </button>
            ) : (
              <span className="flex items-center gap-2 text-sm text-muted-foreground px-4 py-2.5 border border-dashed border-border rounded-lg">Selfie não enviada</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Termos: {submission.terms_accepted ? "✅ Aceitos" : "❌ Não aceitos"}
          </p>
        </div>

        {/* Back button */}
        <div className="flex justify-center pb-4">
          <button
            onClick={() => { window.location.href = "/"; }}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar para o site
          </button>
        </div>

      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
const PagamentoNaEntrada = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [birthDateError, setBirthDateError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [existingSubmission, setExistingSubmission] = useState<Submission | null>(null);
  const [tokenId, setTokenId] = useState<string | null>(null);
  const [reservationId, setReservationId] = useState<string | null>(null);

  const [personal, setPersonal] = useState<PersonalData>({
    full_name: "", cpf: "", birth_date: "",
    street: "", street_number: "", cep: "", complement: "",
    neighborhood: "", city: "", state: "",
    device_os: "", device_brand: "",
  });

  const [docs, setDocs] = useState<DocumentFiles>({ doc_front: null, doc_back: null, selfie: null });
  const [docPreviews, setDocPreviews] = useState<{ doc_front?: string; doc_back?: string; selfie?: string }>({});

  // ── CEP lookup ────────────────────────────
  const { cepData, isFetchingCep, handleCepChange } = useCepLookup();

  const handleCepInput = async (value: string) => {
    const masked = await handleCepChange(value);
    setPersonal(p => ({ ...p, cep: masked }));
  };

  useEffect(() => {
    if (cepData) {
      setPersonal(p => ({
        ...p,
        street: cepData.street || p.street,
        neighborhood: cepData.neighborhood || p.neighborhood,
        city: cepData.city || p.city,
        state: cepData.state || p.state,
      }));
    }
  }, [cepData]);

  // ── Check for existing submission on load ─
  useEffect(() => {
    const checkExistingSubmission = async () => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");
      if (!token) { setIsLoading(false); return; }

      try {
        const { data: tokenData } = await supabase
          .from("entry_payment_tokens")
          .select("id, reservation_id")
          .eq("token", token)
          .single();

        if (tokenData) {
          setTokenId(tokenData.id);
          setReservationId(tokenData.reservation_id);

          // Check for existing submission
          const { data: submissionData } = await supabase
            .from("entry_payment_submissions")
            .select("*")
            .eq("token_id", tokenData.id)
            .maybeSingle();

          if (submissionData) {
            setExistingSubmission(submissionData as Submission);
          }
        }
      } catch (err) {
        console.error("Error checking submission:", err);
      } finally {
        setIsLoading(false);
      }
    };

    checkExistingSubmission();
  }, []);

  // ── Birth date validation ─────────────────
  const validateBirthDate = (value: string): boolean => {
    if (!value) { setBirthDateError("Data obrigatória"); return false; }
    const date = new Date(value + "T00:00:00");
    if (isNaN(date.getTime())) { setBirthDateError("Data inválida"); return false; }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date > today) { setBirthDateError("Data de nascimento não pode ser no futuro"); return false; }
    const minDate = new Date("1900-01-01");
    if (date < minDate) { setBirthDateError("Data de nascimento inválida"); return false; }
    const age = today.getFullYear() - date.getFullYear() - (today < new Date(today.getFullYear(), date.getMonth(), date.getDate()) ? 1 : 0);
    if (age < 18) { setBirthDateError("É necessário ter pelo menos 18 anos"); return false; }
    setBirthDateError("");
    return true;
  };

  // ── File selection ────────────────────────
  const handleFileSelect = (field: keyof DocumentFiles, file: File | null) => {
    if (!file) return;
    setDocs(d => ({ ...d, [field]: file }));
    const url = URL.createObjectURL(file);
    setDocPreviews(p => ({ ...p, [field]: url }));
  };

  // ── Validation per step ───────────────────
  const isStepValid = () => {
    if (currentStep === 0) {
      return (
        personal.full_name.trim() &&
        personal.cpf.trim() &&
        personal.birth_date &&
        !birthDateError &&
        personal.street.trim() &&
        personal.street_number.trim() &&
        personal.cep.trim() &&
        personal.device_os.trim()
      );
    }
    if (currentStep === 1) {
      return docs.doc_front && docs.doc_back && docs.selfie;
    }
    return true;
  };

  // ── Upload file to storage ────────────────
  const uploadFile = async (file: File, path: string): Promise<string | null> => {
    const { error } = await supabase.storage
      .from("kyc-documents")
      .upload(path, file, { upsert: true });
    if (error) { console.error("Upload error:", error); return null; }
    return path;
  };

  // ── Submit ────────────────────────────────
  const handleSubmit = async () => {
    if (!tokenId || !reservationId) {
      toast.error("Token inválido");
      return;
    }
    setIsSubmitting(true);
    try {
      const ts = Date.now();
      const prefix = `${reservationId}/${ts}`;

      const [frontPath, backPath, selfiePath] = await Promise.all([
        docs.doc_front ? uploadFile(docs.doc_front, `${prefix}/doc_front`) : Promise.resolve(null),
        docs.doc_back ? uploadFile(docs.doc_back, `${prefix}/doc_back`) : Promise.resolve(null),
        docs.selfie ? uploadFile(docs.selfie, `${prefix}/selfie`) : Promise.resolve(null),
      ]);

      const { error } = await supabase.from("entry_payment_submissions").insert({
        token_id: tokenId,
        reservation_id: reservationId,
        full_name: personal.full_name,
        cpf: personal.cpf,
        birth_date: personal.birth_date || null,
        street: personal.street,
        street_number: personal.street_number,
        complement: personal.complement || null,
        neighborhood: personal.neighborhood || null,
        city: personal.city || null,
        state: personal.state || null,
        cep: personal.cep,
        doc_front_url: frontPath,
        doc_back_url: backPath,
        selfie_url: selfiePath,
        terms_accepted: true,
        terms_accepted_at: new Date().toISOString(),
        status: "enviado",
        card_token: personal.device_os ? `device_os:${personal.device_os}|device_brand:${personal.device_brand}` : null,
      });

      if (error) throw error;

      // Mark token as used
      await supabase.from("entry_payment_tokens").update({ used_at: new Date().toISOString() }).eq("id", tokenId);

      setIsComplete(true);
      toast.success("Informações enviadas com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao enviar. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Loading ───────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-secondary flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // ── Already submitted — show data ─────────
  if (existingSubmission) {
    return <SubmittedView submission={existingSubmission} />;
  }

  // ── Success screen ────────────────────────
  if (isComplete) {
    return <SuccessScreen />;
  }

  // ─────────────────────────────────────────
  return (
    <div className="min-h-screen bg-secondary py-6 px-4 md:py-8">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
            <Building2 className="w-6 h-6 text-accent-foreground" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">Pagamento na Entrada</h1>
            <p className="text-xs text-muted-foreground">Preencha os dados para garantir sua reserva</p>
          </div>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-6">
          {steps.map((step, i) => {
            const Icon = step.icon;
            const isActive = i === currentStep;
            const isDone = i < currentStep;
            return (
              <div key={i} className="flex items-center gap-2 flex-1">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive ? "bg-primary text-primary-foreground" :
                  isDone ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                }`}>
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{step.label}</span>
                  <span className="sm:hidden">{i + 1}</span>
                </div>
                {i < steps.length - 1 && <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
              </div>
            );
          })}
        </div>

        <Progress value={((currentStep + 1) / steps.length) * 100} className="mb-8 h-2" />

        <div className="bg-card rounded-2xl shadow-sm p-6 md:p-8">

          {/* ── STEP 1: Dados Pessoais & Endereço ── */}
          {currentStep === 0 && (
            <div className="space-y-5">
              <h2 className="font-display text-xl font-semibold flex items-center gap-2">
                <User className="w-5 h-5 text-primary" /> Dados Pessoais
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label>Nome Completo</Label>
                  <Input
                    value={personal.full_name}
                    onChange={e => setPersonal(p => ({ ...p, full_name: e.target.value }))}
                    placeholder="Seu nome completo"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>CPF</Label>
                  <Input
                    value={personal.cpf}
                    onChange={e => setPersonal(p => ({ ...p, cpf: maskCPF(e.target.value) }))}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Data de Nascimento</Label>
                  <Input
                    type="date"
                    value={personal.birth_date}
                    max={new Date().toISOString().split("T")[0]}
                    min="1900-01-01"
                    onChange={e => {
                      setPersonal(p => ({ ...p, birth_date: e.target.value }));
                      if (e.target.value) validateBirthDate(e.target.value);
                    }}
                    onBlur={e => e.target.value && validateBirthDate(e.target.value)}
                    className={`mt-1 ${birthDateError ? "border-destructive" : ""}`}
                  />
                  {birthDateError && <p className="text-xs text-destructive mt-1">{birthDateError}</p>}
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <h3 className="font-medium flex items-center gap-2 mb-4 text-foreground">
                  <MapPin className="w-4 h-4 text-primary" /> Endereço
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>CEP</Label>
                    <div className="relative mt-1">
                      <Input
                        value={personal.cep}
                        onChange={e => handleCepInput(e.target.value)}
                        placeholder="00000-000"
                        maxLength={9}
                      />
                      {isFetchingCep && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  </div>
                  <div>
                    <Label>Número</Label>
                    <Input
                      value={personal.street_number}
                      onChange={e => setPersonal(p => ({ ...p, street_number: e.target.value }))}
                      placeholder="Ex: 123"
                      className="mt-1"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Rua</Label>
                    <Input
                      value={personal.street}
                      onChange={e => setPersonal(p => ({ ...p, street: e.target.value }))}
                      placeholder="Nome da rua"
                      className="mt-1"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Complemento</Label>
                    <Input
                      value={personal.complement}
                      onChange={e => setPersonal(p => ({ ...p, complement: e.target.value }))}
                      placeholder="Apto, bloco, etc."
                      className="mt-1"
                    />
                  </div>
                  {personal.neighborhood && (
                    <div>
                      <Label>Bairro</Label>
                      <Input value={personal.neighborhood} readOnly className="mt-1 bg-muted" />
                    </div>
                  )}
                  {personal.city && (
                    <div>
                      <Label>Cidade / Estado</Label>
                      <Input value={`${personal.city} / ${personal.state}`} readOnly className="mt-1 bg-muted" />
                    </div>
                  )}
                </div>
              </div>

              {/* Device OS & Brand */}
              <div className="border-t border-border pt-4">
                <h3 className="font-medium flex items-center gap-2 mb-4 text-foreground">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
                  </svg>
                  Celular
                </h3>

                {/* OS Selection */}
                <div className="mb-4">
                  <Label className="mb-2 block">Sistema Operacional</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {["iOS (iPhone)", "Android"].map((os) => (
                      <button
                        key={os}
                        type="button"
                        onClick={() => setPersonal(p => ({ ...p, device_os: os, device_brand: "" }))}
                        className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                          personal.device_os === os
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-card text-foreground hover:border-primary/50"
                        }`}
                      >
                        {os === "iOS (iPhone)" ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993.0001.5511-.4482.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993 0 .5511-.4482.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.2439 13.8533 7.8508 12 7.8508s-3.5902.3931-5.1367 1.0989L4.841 5.4467a.4161.4161 0 00-.5677-.1521.4157.4157 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3435-4.1021-2.6892-7.5743-6.1185-9.4396"/>
                          </svg>
                        )}
                        {os}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: Documentos ── */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="font-display text-xl font-semibold flex items-center gap-2">
                <Upload className="w-5 h-5 text-primary" /> Documentos
              </h2>
              <p className="text-sm text-muted-foreground">
                Envie fotos do seu documento de identidade (RG ou CNH) e uma selfie segurando o documento.
              </p>

              <FileUploadButton
                fieldKey="doc_front"
                label="Foto Frente do Documento"
                desc="Frente do RG ou CNH"
                file={docs.doc_front}
                preview={docPreviews.doc_front}
                onSelect={handleFileSelect}
              />

              <div className="border-t border-border" />

              <FileUploadButton
                fieldKey="doc_back"
                label="Foto Verso do Documento"
                desc="Verso do RG ou CNH"
                file={docs.doc_back}
                preview={docPreviews.doc_back}
                onSelect={handleFileSelect}
              />

              <div className="border-t border-border" />

              <FileUploadButton
                fieldKey="selfie"
                label="Selfie"
                desc="Foto sua segurando o documento"
                file={docs.selfie}
                preview={docPreviews.selfie}
                onSelect={handleFileSelect}
              />
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex gap-3 mt-8 pt-6 border-t border-border">
            {currentStep > 0 && (
              <Button variant="outline" onClick={() => setCurrentStep(s => s - 1)} className="flex-1">
                <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
            )}
            {currentStep < steps.length - 1 ? (
              <Button
                onClick={() => setCurrentStep(s => s + 1)}
                disabled={!isStepValid()}
                className="flex-1"
              >
                Próximo <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!isStepValid() || isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                Enviar Informações
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PagamentoNaEntrada;
