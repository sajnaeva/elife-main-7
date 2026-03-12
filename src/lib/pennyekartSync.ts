import { supabase } from "@/integrations/supabase/client";
import { pennyekartClient } from "@/lib/pennyekartClient";

export interface SyncResult {
  products: any[];
  categories: any[];
  orders: any[];
  variants: any[];
  synced: boolean;
  error?: string;
}

export async function syncPennyekartData(): Promise<SyncResult> {
  const now = new Date().toISOString();

  // Fetch from external pennyekart DB
  const [productsRes, categoriesRes, ordersRes, variantsRes] = await Promise.all([
    pennyekartClient.from("products").select("*"),
    pennyekartClient.from("categories").select("*"),
    pennyekartClient.from("orders").select("*").order("created_at", { ascending: false }),
    pennyekartClient.from("product_variants").select("*"),
  ]);

  if (productsRes.error) throw new Error(`Products: ${productsRes.error.message}`);
  if (categoriesRes.error) throw new Error(`Categories: ${categoriesRes.error.message}`);
  if (ordersRes.error) throw new Error(`Orders: ${ordersRes.error.message}`);
  if (variantsRes.error) throw new Error(`Variants: ${variantsRes.error.message}`);

  const products = productsRes.data || [];
  const categories = categoriesRes.data || [];
  const orders = ordersRes.data || [];
  const variants = variantsRes.data || [];

  // Upsert into local Supabase DB
  const upsertErrors: string[] = [];

  if (products.length > 0) {
    const { error } = await supabase.from("pennyekart_products" as any).upsert(
      products.map((p: any) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        mrp: p.mrp,
        purchase_rate: p.purchase_rate,
        category: p.category,
        stock: p.stock,
        is_active: p.is_active,
        section: p.section || '',
        discount_rate: p.discount_rate || 0,
        coming_soon: p.coming_soon || false,
        margin_percentage: p.margin_percentage,
        wallet_points: p.wallet_points || 0,
        featured_discount_type: p.featured_discount_type || '',
        featured_discount_value: p.featured_discount_value || 0,
        source_created_at: p.created_at,
        synced_at: now,
      })),
      { onConflict: 'id' }
    );
    if (error) upsertErrors.push(`Products: ${error.message}`);
  }

  if (categories.length > 0) {
    const { error } = await supabase.from("pennyekart_categories" as any).upsert(
      categories.map((c: any) => ({
        id: c.id,
        name: c.name,
        icon: c.icon || '',
        item_count: c.item_count || '0',
        sort_order: c.sort_order || 0,
        is_active: c.is_active,
        category_type: c.category_type || '',
        image_url: c.image_url || '',
        margin_percentage: c.margin_percentage || 0,
        synced_at: now,
      })),
      { onConflict: 'id' }
    );
    if (error) upsertErrors.push(`Categories: ${error.message}`);
  }

  if (orders.length > 0) {
    const { error } = await supabase.from("pennyekart_orders" as any).upsert(
      orders.map((o: any) => ({
        id: o.id,
        total_amount: o.total_amount || 0,
        status: o.status || '',
        customer_name: o.customer_name,
        customer_phone: o.customer_phone,
        items: o.items,
        payment_method: o.payment_method,
        delivery_address: o.delivery_address,
        source_created_at: o.created_at,
        synced_at: now,
        raw_data: o,
        collected_amount: o.collected_amount || o.total_amount || 0,
        godown: o.godown || o.warehouse || '',
        panchayath_name: o.panchayath_name || o.panchayath || '',
        ward: o.ward || '',
        district: o.district || '',
        cost_amount: o.cost_amount || o.purchase_cost || 0,
        profit_amount: o.profit_amount || o.profit || 0,
      })),
      { onConflict: 'id' }
    );
    if (error) upsertErrors.push(`Orders: ${error.message}`);
  }

  if (variants.length > 0) {
    const { error } = await supabase.from("pennyekart_product_variants" as any).upsert(
      variants.map((v: any) => ({
        id: v.id,
        product_id: v.product_id,
        variant_label: v.variant_label || '',
        price: v.price,
        mrp: v.mrp,
        stock: v.stock,
        is_active: v.is_active,
        synced_at: now,
      })),
      { onConflict: 'id' }
    );
    if (error) upsertErrors.push(`Variants: ${error.message}`);
  }

  return {
    products,
    categories,
    orders,
    variants,
    synced: upsertErrors.length === 0,
    error: upsertErrors.length > 0 ? upsertErrors.join('; ') : undefined,
  };
}

export async function loadCachedData(): Promise<SyncResult> {
  const [productsRes, categoriesRes, ordersRes, variantsRes] = await Promise.all([
    supabase.from("pennyekart_products" as any).select("*"),
    supabase.from("pennyekart_categories" as any).select("*"),
    supabase.from("pennyekart_orders" as any).select("*").order("source_created_at", { ascending: false }),
    supabase.from("pennyekart_product_variants" as any).select("*"),
  ]);

  return {
    products: productsRes.data || [],
    categories: categoriesRes.data || [],
    orders: ordersRes.data || [],
    variants: variantsRes.data || [],
    synced: true,
  };
}
