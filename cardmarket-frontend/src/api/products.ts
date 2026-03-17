import { apiGet } from "./client";

export interface Product {
  id: number;
  name: string;
  cardmarket_url: string;
  game: string | null;
  language: string | null;
  set_name: string | null;
  release_date: string | null;
  is_active: boolean;
}

export async function fetchProduct(productId: number): Promise<Product> {
  return apiGet<Product>(`/products/${productId}`);
}

export async function fetchProducts(): Promise<Product[]> {
  return apiGet<Product[]>("/products/");
}
