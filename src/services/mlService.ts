import axios from 'axios';
import { ML_API_URL } from '@env';
import { Product } from '@/types/product';

interface MLRecommendation {
  product_id: number;
  product_name: string;
  price: number;
  description: string;
  subcategory: {
    id: number;
    name: string;
    slug: string;
    category: {
      id: number;
      name: string;
      slug: string;
    };
  };
  theme_ids: number[];
  image_urls: string[];
  _score: number;
}

interface MLResponse {
  product_id: number;
  recommendations: MLRecommendation[];
}

export const mlService = {
  async getRecommendations(productId: number, n: number = 10): Promise<Product[]> {
    try {
      const response = await axios.get<MLResponse>(`${ML_API_URL}/recommend/${productId}?n=${n}`);
      
      if (!response.data || !response.data.recommendations) {
        return [];
      }

      return response.data.recommendations.map((rec) => ({
        id: rec.product_id,
        name: rec.product_name,
        description: rec.description,
        price: rec.price,
        image_url: rec.image_urls && rec.image_urls.length > 0 ? rec.image_urls[0] : null,
        category: rec.subcategory?.category?.name || '',
        stock: 10, // Valor padrão pois a API de ML não retorna estoque
        gallery: rec.image_urls,
        themeIds: rec.theme_ids,
        subcategoryName: rec.subcategory?.name
      }));
    } catch (error: any) {
      // Se for 404, significa que o produto não tem recomendações ou não existe no modelo ainda
      if (error.response && error.response.status === 404) {
        return [];
      }
      console.error('Erro ao buscar recomendações:', error);
      return [];
    }
  },

  async wakeUp(): Promise<void> {
    try {
      // URL direta da API ML para garantir que ela acorde
      // Usamos a URL direta pois o ML_API_URL pode estar apontando para o proxy do backend
      const DIRECT_ML_URL = 'https://api-ml-benucci.onrender.com'; 
      console.log('Acordando API de ML...');
      
      // Tenta fazer um request simples. 
      // Em Web, pode dar erro de CORS se não for proxy, mas o request chega no servidor e o acorda.
      // Usamos fetch simples para não depender da configuração do axios
      await fetch(`${DIRECT_ML_URL}/`, { method: 'GET' }).catch(() => {});
      
      console.log('Ping enviado para API de ML');
    } catch (error) {
      // Ignora erros, é apenas um ping
    }
  }
};
