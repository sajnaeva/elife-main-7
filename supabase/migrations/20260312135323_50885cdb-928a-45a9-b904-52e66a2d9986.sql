
-- Table to cache pennyekart products
CREATE TABLE public.pennyekart_products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  mrp NUMERIC NOT NULL DEFAULT 0,
  purchase_rate NUMERIC NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT '',
  stock INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  section TEXT DEFAULT '',
  discount_rate NUMERIC NOT NULL DEFAULT 0,
  coming_soon BOOLEAN NOT NULL DEFAULT false,
  margin_percentage NUMERIC,
  wallet_points NUMERIC NOT NULL DEFAULT 0,
  featured_discount_type TEXT DEFAULT '',
  featured_discount_value NUMERIC NOT NULL DEFAULT 0,
  source_created_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table to cache pennyekart categories
CREATE TABLE public.pennyekart_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '',
  item_count TEXT DEFAULT '0',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  category_type TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  margin_percentage NUMERIC NOT NULL DEFAULT 0,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table to cache pennyekart orders
CREATE TABLE public.pennyekart_orders (
  id TEXT PRIMARY KEY,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT DEFAULT '',
  customer_name TEXT,
  customer_phone TEXT,
  items JSONB,
  payment_method TEXT,
  delivery_address TEXT,
  source_created_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table to cache pennyekart product variants
CREATE TABLE public.pennyekart_product_variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  variant_label TEXT DEFAULT '',
  price NUMERIC NOT NULL DEFAULT 0,
  mrp NUMERIC NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: only super_admin can manage, public can read
ALTER TABLE public.pennyekart_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pennyekart_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pennyekart_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pennyekart_product_variants ENABLE ROW LEVEL SECURITY;

-- Select policies (super admin only for now)
CREATE POLICY "Super admin can manage pennyekart_products" ON public.pennyekart_products FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admin can manage pennyekart_categories" ON public.pennyekart_categories FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admin can manage pennyekart_orders" ON public.pennyekart_orders FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admin can manage pennyekart_product_variants" ON public.pennyekart_product_variants FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));
