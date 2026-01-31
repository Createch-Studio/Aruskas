-- Add cost column to products table (for calculating profit margin)
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost DECIMAL(15,2) NOT NULL DEFAULT 0;

-- Add total_cost column to sales table
ALTER TABLE sales ADD COLUMN IF NOT EXISTS total_cost DECIMAL(15,2) NOT NULL DEFAULT 0;

-- Rename date to sale_date for consistency (only if column exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'date') THEN
    ALTER TABLE sales RENAME COLUMN date TO sale_date;
  END IF;
END $$;

-- Add unit_cost column to sale_items table
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(15,2) NOT NULL DEFAULT 0;
