export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  category: string;
  stock: number;
  categoryId?: number | null;
}

export interface User {
  full_name: string;
}