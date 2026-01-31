-- Function to create default expense categories for new users
CREATE OR REPLACE FUNCTION public.create_default_expense_categories()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO expense_categories (user_id, name, description)
  VALUES
    (NEW.id, 'Bahan Baku', 'Raw materials untuk memasak'),
    (NEW.id, 'Promosi', 'Biaya promosi dan marketing'),
    (NEW.id, 'Branding', 'Biaya branding dan desain'),
    (NEW.id, 'Gaji', 'Gaji karyawan'),
    (NEW.id, 'Operasional', 'Biaya operasional (gas, air, listrik, dll)')
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Trigger to create default categories when a new user signs up
DROP TRIGGER IF EXISTS on_auth_user_created_categories ON auth.users;

CREATE TRIGGER on_auth_user_created_categories
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_expense_categories();
