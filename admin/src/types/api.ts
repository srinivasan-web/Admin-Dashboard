export type ApiResponse<T> = {
  data: T;
};

export type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
    details?: Record<string, string[]>;
  };
};

export type PaginationMeta = {
  page?: number;
  perPage?: number;
  total?: number;
  totalPages?: number;
};
