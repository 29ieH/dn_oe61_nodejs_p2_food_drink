export interface PaginationParams {
  page: number;
  pageSize: number;
}
export interface PaginationMeta {
  currentPage: number;
  itemCount: number;
  totalItems: number;
  totalPages: number;
  itemsPerPage: number;
}
export interface PaginationResult<T> {
  data: T[];
  meta: PaginationMeta;
}
