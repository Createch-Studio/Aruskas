CREATE TABLE public.debt_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  debt_id UUID REFERENCES public.debts(id) ON DELETE CASCADE,
  user_id UUID DEFAULT auth.uid() NOT NULL, -- Tambahkan kolom ini untuk RLS
  amount NUMERIC NOT NULL,
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Aktifkan RLS
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;

-- Buat Policy agar user hanya bisa akses data miliknya sendiri
CREATE POLICY "Users can manage their own payments" 
ON public.debt_payments 
FOR ALL 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);