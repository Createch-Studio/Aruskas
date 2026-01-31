-- Add status column to purchase_invoices if not exists
ALTER TABLE purchase_invoices ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';

-- Rename invoice_id to purchase_invoice_id in purchase_invoice_items if needed
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_invoice_items' AND column_name = 'invoice_id') THEN
    ALTER TABLE purchase_invoice_items RENAME COLUMN invoice_id TO purchase_invoice_id;
  END IF;
END $$;

-- Drop old foreign key constraint if exists and recreate
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'purchase_invoice_items_invoice_id_fkey') THEN
    ALTER TABLE purchase_invoice_items DROP CONSTRAINT purchase_invoice_items_invoice_id_fkey;
  END IF;
END $$;

-- Recreate RLS policies for purchase_invoice_items with correct column name
DROP POLICY IF EXISTS "Users can view own purchase invoice items" ON purchase_invoice_items;
DROP POLICY IF EXISTS "Users can insert own purchase invoice items" ON purchase_invoice_items;
DROP POLICY IF EXISTS "Users can update own purchase invoice items" ON purchase_invoice_items;
DROP POLICY IF EXISTS "Users can delete own purchase invoice items" ON purchase_invoice_items;

CREATE POLICY "Users can view own purchase invoice items" ON purchase_invoice_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM purchase_invoices WHERE id = purchase_invoice_items.purchase_invoice_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can insert own purchase invoice items" ON purchase_invoice_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM purchase_invoices WHERE id = purchase_invoice_items.purchase_invoice_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can update own purchase invoice items" ON purchase_invoice_items
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM purchase_invoices WHERE id = purchase_invoice_items.purchase_invoice_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can delete own purchase invoice items" ON purchase_invoice_items
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM purchase_invoices WHERE id = purchase_invoice_items.purchase_invoice_id AND user_id = auth.uid())
  );
