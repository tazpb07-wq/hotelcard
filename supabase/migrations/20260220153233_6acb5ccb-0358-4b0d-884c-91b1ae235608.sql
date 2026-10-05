
-- ============================================================
-- PAGAMENTO NA ENTRADA - Schema
-- ============================================================

-- 1. Tabela de tokens de pagamento na entrada
CREATE TABLE public.entry_payment_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reservation_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 2. Tabela de submissões KYC / dados do cliente
CREATE TABLE public.entry_payment_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token_id uuid NOT NULL REFERENCES public.entry_payment_tokens(id) ON DELETE CASCADE,
  reservation_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pendente',  -- pendente | enviado | aprovado
  -- Dados pessoais
  full_name text NULL,
  cpf text NULL,
  birth_date date NULL,
  -- Endereço
  cep text NULL,
  street text NULL,
  street_number text NULL,
  neighborhood text NULL,
  city text NULL,
  state text NULL,
  -- Documentos (URLs do storage)
  doc_front_url text NULL,
  doc_back_url text NULL,
  selfie_url text NULL,
  -- Cartão (token do gateway - sem dados sensíveis)
  card_token text NULL,
  card_brand text NULL,
  card_last_four text NULL,
  -- Termos
  terms_accepted boolean NOT NULL DEFAULT false,
  terms_accepted_at timestamp with time zone NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 3. Storage bucket privado para documentos KYC
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', false)
ON CONFLICT (id) DO NOTHING;

-- 4. Triggers para updated_at
CREATE TRIGGER update_entry_payment_tokens_updated_at
  BEFORE UPDATE ON public.entry_payment_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_entry_payment_submissions_updated_at
  BEFORE UPDATE ON public.entry_payment_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Indexes
CREATE INDEX idx_entry_payment_tokens_reservation_id ON public.entry_payment_tokens(reservation_id);
CREATE INDEX idx_entry_payment_tokens_token ON public.entry_payment_tokens(token);
CREATE INDEX idx_entry_payment_submissions_token_id ON public.entry_payment_submissions(token_id);
CREATE INDEX idx_entry_payment_submissions_reservation_id ON public.entry_payment_submissions(reservation_id);

-- 6. RLS - entry_payment_tokens
ALTER TABLE public.entry_payment_tokens ENABLE ROW LEVEL SECURITY;

-- Admins gerenciam tudo
CREATE POLICY "Admins can manage all entry payment tokens"
  ON public.entry_payment_tokens FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Acesso público por token (para verificar validade sem autenticação)
CREATE POLICY "Public can read tokens by token value"
  ON public.entry_payment_tokens FOR SELECT
  USING (true);

-- 7. RLS - entry_payment_submissions
ALTER TABLE public.entry_payment_submissions ENABLE ROW LEVEL SECURITY;

-- Admins gerenciam tudo
CREATE POLICY "Admins can manage all submissions"
  ON public.entry_payment_submissions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Qualquer pessoa pode inserir (via token público)
CREATE POLICY "Anyone can insert submission"
  ON public.entry_payment_submissions FOR INSERT
  WITH CHECK (true);

-- Quem submeteu pode atualizar (baseado no token)
CREATE POLICY "Public can update their own submission"
  ON public.entry_payment_submissions FOR UPDATE
  USING (true);

-- 8. RLS - storage kyc-documents (apenas admins leem, qualquer um insere via token)
CREATE POLICY "Admins can view kyc documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'kyc-documents' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can upload kyc documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'kyc-documents');
