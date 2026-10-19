export type Master = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  is_active?: boolean;
  sort_order?: number;
  image_media_id?: string | null;
  image_url?: string | null;
  image_media?: {
    id: string;
    url: string;
    mime_type: string | null;
    original_filename?: string | null;
    size_bytes?: number | null;
  } | null;
};

export type WarehouseLocation = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  latitude: string | null;
  longitude: string | null;
};

export type Product = {
  edit_token?: string;
  inventory?: {
    physical: number;
    reserved: number;
    available: number;
    warehouses: Array<{
      warehouse_id: string;
      warehouse_name: string;
      physical: number;
      reserved: number;
      available: number;
    }>;
  };
  specifications?: ProductSpecification[];
  highlights?: ProductHighlight[];
  id: string;
  name: string;
  sku: string;
  group_name: string | null;
  available_stock: number;
  is_active: boolean;
  is_trade_product: boolean;
  sort_order: number;
  description: string | null;
  slug?: string | null;
  short_description?: string | null;
  details?: Array<{
    id?: string;
    title: string;
    content: string;
    sort_order: number;
    is_active: boolean;
  }>;
  additional_details?: {
    generic_name: string | null;
    model_number: string | null;
    net_quantity: string | null;
    country_of_origin: string | null;
    manufactured_by: string | null;
    marketed_by: string | null;
    consumer_complaints: string | null;
  } | null;
  tag: string | null;
  images?: ProductImage[];
  price: { mrp: string; sale: string | null };
  brand: Master;
  category: Master;
  product_type: Master;
  hsn_code?: HsnCode | null;
};

export type ProductImage = {
  sort_order?: number;
  id: string;
  type: string;
  is_primary: boolean;
  url: string;
};

export type HsnCode = {
  id: string;
  title: string;
  hsn_code: string | null;
  type: string | null;
  sgst_tax_multiplier: string | null;
  igst_tax_multiplier: string | null;
};

export type ComboItem = {
  product_id: string;
  name: string;
  sku: string;
  quantity: number;
};
export type Combo = {
  id: string;
  name: string;
  is_active: boolean;
  items: ComboItem[];
};
export type CatalogAttribute = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
  data_type: string;
  unit: string | null;
  is_filterable: boolean;
  is_active: boolean;
  sort_order: number;
};
export type ProductSpecification = {
  id: string;
  attribute: CatalogAttribute;
  value: string;
  sort_order: number;
  show_on_top: boolean;
};
export type ProductHighlight = {
  id: string;
  product_attribute_id: string;
  sort_order: number;
  is_active: boolean;
  specification: ProductSpecification;
};

export type StockMovement = {
  id: string;
  movement_type:
    | "manual_set"
    | "stock_in"
    | "stock_out"
    | "RESERVE"
    | "RELEASE"
    | "COMMIT"
    | "RESTORE"
    | "RESERVATION_CREATED"
    | "RESERVATION_RELEASED"
    | "ORDER_COMMITTED"
    | "CANCELLATION_RESTORE";
  quantity_delta: number;
  quantity: number | null;
  order_id: string | null;
  order_item_id: string | null;
  idempotency_key: string | null;
  created_at: string | null;
  created_by: { id: string; name: string } | null;
};

export type WarehouseStockSnapshot = {
  warehouse_id: string;
  product_id: string;
  quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  movements: StockMovement[];
};

export type CatalogMasters = {
  brands: Master[];
  categories: Master[];
  productTypes: Master[];
  warehouses: WarehouseLocation[];
  hsnCodes: HsnCode[];
};
