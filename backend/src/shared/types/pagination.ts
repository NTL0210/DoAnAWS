export interface PaginatedResult<T> {
  items: T[];
  nextToken?: string | undefined;
}
