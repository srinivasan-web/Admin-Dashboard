export type ProductPrice = {
  mrp: number;
  sale?: number;
};

export type Product = {
  id: string;
  name: string;
  sku: string;
  description?: string | null;
  is_active: boolean;
  is_trade_product: boolean;
  group_name?: string | null;
  tag?: string | null;
  sort_order: number;
  brand: { id: string; name: string };
  category: { id: string; name: string };
  product_type: { id: string; name: string };
  hsn_code?: { id: string; title: string; hsn_code?: string };
  price: ProductPrice;
  images?: Array<{ id: string; url: string }>;
  available_stock: number;
};
