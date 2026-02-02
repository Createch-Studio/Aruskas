-- Create inventory table for stock management
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  unit TEXT DEFAULT 'pcs',
  quantity DECIMAL(15,2) NOT NULL DEFAULT 0,
  min_quantity DECIMAL(15,2) DEFAULT 0,
  unit_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create inventory_transactions table for tracking stock movements
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  inventory_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('in', 'out', 'adjustment')),
  quantity DECIMAL(15,2) NOT NULL,
  unit_cost DECIMAL(15,2),
  notes TEXT,
  transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create assets table for asset management
CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  purchase_date DATE,
  purchase_price DECIMAL(15,2) DEFAULT 0,
  current_value DECIMAL(15,2) DEFAULT 0,
  location TEXT,
  condition TEXT DEFAULT 'good' CHECK (condition IN ('good', 'fair', 'poor', 'broken')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'disposed', 'sold')),
  serial_number TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

-- RLS policies for inventory
CREATE POLICY "inventory_select_own" ON inventory FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "inventory_insert_own" ON inventory FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "inventory_update_own" ON inventory FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "inventory_delete_own" ON inventory FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for inventory_transactions
CREATE POLICY "inventory_transactions_select_own" ON inventory_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "inventory_transactions_insert_own" ON inventory_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "inventory_transactions_update_own" ON inventory_transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "inventory_transactions_delete_own" ON inventory_transactions FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for assets
CREATE POLICY "assets_select_own" ON assets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "assets_insert_own" ON assets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "assets_update_own" ON assets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "assets_delete_own" ON assets FOR DELETE USING (auth.uid() = user_id);
