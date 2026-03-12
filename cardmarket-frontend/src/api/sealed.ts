import { apiGet } from "./client";

export interface SealedContentItem {
  id: number;
  product_id: number;
  component_type: string;
  qty: number;
  linked_product_id: number | null;
  linked_product_name: string | null;
  product_name?: string | null;
}

export interface SealedContentsResponse {
  product_id: number;
  items: SealedContentItem[];
}

export async function fetchSealedContents(productId: number): Promise<SealedContentsResponse> {
  return apiGet<SealedContentsResponse>(`/sealed-contents/${productId}`);
}
