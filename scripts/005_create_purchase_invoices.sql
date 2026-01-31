-- Create purchase_invoices table for tracking raw material purchases per client order
CREATE TABLE IF NOT EXISTS purchase_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  description TEXT,
  total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add unique constraint for invoice number per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_invoices_number ON purchase_invoices(user_id, invoice_number);

-- Enable RLS
ALTER TABLE purchase_invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own purchase invoices" ON purchase_invoices
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own purchase invoices" ON purchase_invoices
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own purchase invoices" ON purchase_invoices
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own purchase invoices" ON purchase_invoices
  FOR DELETE USING (auth.uid() = user_id);

-- Create purchase_invoice_items for itemized expenses
CREATE TABLE IF NOT EXISTS purchase_invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_price DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE purchase_invoice_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for items (inherit from parent invoice)
CREATE POLICY "Users can view own purchase invoice items" ON purchase_invoice_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM purchase_invoices WHERE id = purchase_invoice_items.invoice_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can insert own purchase invoice items" ON purchase_invoice_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM purchase_invoices WHERE id = purchase_invoice_items.invoice_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can update own purchase invoice items" ON purchase_invoice_items
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM purchase_invoices WHERE id = purchase_invoice_items.invoice_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can delete own purchase invoice items" ON purchase_invoice_items
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM purchase_invoices WHERE id = purchase_invoice_items.invoice_id AND user_id = auth.uid())
  );

-- Add purchase_invoice_id to sales table to link invoice as additional cost
ALTER TABLE sales ADD COLUMN IF NOT EXISTS purchase_invoice_id UUID REFERENCES purchase_invoices(id) ON DELETE SET NULL;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS additional_cost DECIMAL(15,2) NOT NULL DEFAULT 0;
