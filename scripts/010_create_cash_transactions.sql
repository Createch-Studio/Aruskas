-- Create cash_transactions table
CREATE TABLE IF NOT EXISTS cash_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cash_id UUID NOT NULL REFERENCES cash(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'in' or 'out'
  amount DECIMAL(15, 2) NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_cash_transactions_cash_id ON cash_transactions(cash_id);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_date ON cash_transactions(transaction_date);

-- Enable RLS
ALTER TABLE cash_transactions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own cash transactions"
  ON cash_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cash
      WHERE cash.id = cash_transactions.cash_id
      AND cash.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own cash transactions"
  ON cash_transactions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cash
      WHERE cash.id = cash_transactions.cash_id
      AND cash.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own cash transactions"
  ON cash_transactions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM cash
      WHERE cash.id = cash_transactions.cash_id
      AND cash.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own cash transactions"
  ON cash_transactions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM cash
      WHERE cash.id = cash_transactions.cash_id
      AND cash.user_id = auth.uid()
    )
  );
