import { apiFormRequest, apiRequest, type ApiResponse } from "../../api/client";
import { publishBannerUpdate } from "../../../../shared/bannerUpdates";

export type BannerMedia = {
  id: string;
  url: string;
  mime_type: string | null;
  original_filename?: string | null;
  size_bytes?: number | null;
};

export function listMedia(search = "", page = 1) {
  const query = new URLSearchParams({ page: String(page) });
  if (search.trim()) query.set("search", search.trim());
  return apiRequest<{
    data: BannerMedia[];
    meta: { current_page: number; last_page: number; total: number };
  }>(`/media?${query}`);
}

export function uploadMedia(file: File) {
  const body = new FormData();
  body.set("image", file);
  return apiFormRequest<ApiResponse<BannerMedia>>("/media", body);
}

export type Banner = {
  id: string;
  title: string;
  description: string | null;
  cta_text: string | null;
  desktop_media_id: string;
  mobile_media_id: string;
  desktop_media: BannerMedia;
  mobile_media: BannerMedia;
  page: string | null;
  sort_order: number;
  redirect_url: string | null;
  start_at: string | null;
  end_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type BannerInput = {
  title: string;
  description: string | null;
  cta_text: string | null;
  desktop_media_id: string;
  mobile_media_id: string;
  page: string;
  sort_order: number;
  redirect_url: string | null;
  start_at: string | null;
  end_at: string | null;
  is_active: boolean;
};

export type BannerFilters = {
  search?: string;
  status?: "active" | "inactive";
  scheduling?: "current" | "upcoming" | "expired" | "unscheduled";
  sort_order?: "asc" | "desc";
};

type PaginatedBanners = {
  data: Banner[];
  meta: { current_page: number; last_page: number; total: number };
};

export async function listBanners(filters: BannerFilters): Promise<Banner[]> {
  const query = new URLSearchParams({ per_page: "100" });
  Object.entries(filters).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const first = await apiRequest<PaginatedBanners>(`/banners?${query}`);
  if (first.meta.last_page <= 1) return first.data;

  // The API does not filter by banner placement. Load every server page so
  // Landing/Listing tabs and their record counts cover the complete result.
  const remaining = await Promise.all(
    Array.from({ length: first.meta.last_page - 1 }, (_, index) =>
      apiRequest<PaginatedBanners>(`/banners?${query}&page=${index + 2}`),
    ),
  );
  return [first.data, ...remaining.map((page) => page.data)].flat();
}

export function getBanner(id: string) {
  return apiRequest<ApiResponse<Banner>>(`/banners/${encodeURIComponent(id)}`);
}

export async function createBanner(input: BannerInput) {
  const response = await apiRequest<ApiResponse<Banner>>(
    "/banners",
    "POST",
    input,
  );
  publishBannerUpdate();
  return response;
}

export async function updateBanner(id: string, input: Partial<BannerInput>) {
  const response = await apiRequest<ApiResponse<Banner>>(
    `/banners/${encodeURIComponent(id)}`,
    "PUT",
    input,
  );
  publishBannerUpdate();
  return response;
}

export async function deleteBanner(id: string) {
  const response = await apiRequest<ApiResponse<null>>(
    `/banners/${encodeURIComponent(id)}`,
    "DELETE",
  );
  publishBannerUpdate();
  return response;
}
