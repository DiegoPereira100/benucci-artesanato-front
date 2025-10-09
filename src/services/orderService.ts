import ApiService, { OrderRequestDTO, OrderResponseDTO } from './api';

export const orderService = {
  /**
   * Criar pedido
   */
  createOrder: async (orderData: OrderRequestDTO): Promise<OrderResponseDTO> => {
    return await ApiService.createOrder(orderData);
  },

  /**
   * Buscar detalhes do pedido
   */
  getOrderById: async (id: number) => {
    return await ApiService.getOrderById(id);
  },

  /**
   * Buscar pedidos do usuário
   */
  getUserOrders: async (userId: number) => {
    return await ApiService.getUserOrders(userId);
  },

  /**
   * Atualizar status do pedido
   */
  updateOrderStatus: async (orderId: number, status: string) => {
    return await ApiService.updateOrderStatus(orderId, status);
  },
};