export interface Client {
  id: string
  user_id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  created_at: string
}

export interface ExpenseCategory {
  id: string
  user_id: string
  name: string
  created_at: string
}

export interface Expense {
  id: string
  user_id: string
  category_id: string
  client_id: string | null
  description: string
  amount: number
  date: string
  created_at: string
  category?: ExpenseCategory
  client?: Client
}

export interface Product {
  id: string
  user_id: string
  name: string
  description: string | null
  price: number
  cost: number
  is_active: boolean
  created_at: string
}

export interface Sale {
  id: string
  user_id: string
  client_id: string | null
  purchase_invoice_id: string | null
  total_amount: number
  total_cost: number
  additional_cost: number
  notes: string | null
  sale_date: string
  created_at: string
  items?: SaleItem[]
  client?: Client
  purchase_invoice?: PurchaseInvoice
}

export interface SaleItem {
  id: string
  sale_id: string
  product_id: string
  quantity: number
  unit_price: number
  unit_cost: number
  created_at: string
  product?: Product
}

export interface DashboardStats {
  totalExpenses: number
  totalSales: number
  totalProfit: number
  profitMargin: number
}

export interface ExpenseByCategory {
  category: string
  amount: number
}

export interface SalesByDate {
  date: string
  sales: number
  profit: number
}

export interface PurchaseInvoice {
  id: string
  user_id: string
  client_id: string
  invoice_number: string
  description: string | null
  total_amount: number
  invoice_date: string
  status: 'pending' | 'used' | 'cancelled'
  created_at: string
  client?: Client
  items?: PurchaseInvoiceItem[]
}

export interface PurchaseInvoiceItem {
  id: string
  purchase_invoice_id: string
  description: string
  quantity: number
  unit_price: number
  created_at: string
}

export interface Order {
  id: string
  user_id: string
  client_id: string | null
  order_number: string
  total_amount: number
  order_date: string
  due_date: string | null
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  notes: string | null
  created_at: string
  client?: Client
  items?: OrderItem[]
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string | null
  description: string
  quantity: number
  unit_price: number
  created_at: string
  product?: Product
}
