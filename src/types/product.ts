export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  category: string;
  stock: number;
  categoryId?: number | null;
  subcategoryId?: number | null;
  subcategoryName?: string | null;
  gallery?: string[];
  themeIds?: number[];
  themeNames?: string[];
}

export interface User {
  full_name: string;
}