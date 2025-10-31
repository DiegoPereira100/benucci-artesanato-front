import ApiService from './api';
import { UpdateUserRequest, User } from '@/types/auth';
import { parseAddress, sanitizeAddressParts, serializeAddress } from '../utils/address';

const normalizeUser = (data: any): User => {
  if (!data) {
    return {
      id: 0,
      name: '',
      email: '',
      cpf: '',
      phoneNumber: '',
      address: '',
      type: 'USER',
    };
  }

  const rawType = (data.type ?? data.role ?? 'USER').toString().toUpperCase();

  return {
    id: Number(data.id) || 0,
    name: data.name ?? '',
    email: data.email ?? '',
    cpf: data.cpf ?? '',
    phoneNumber: data.phoneNumber ?? '',
    address: serializeAddress(parseAddress(data.address)),
    type: rawType === 'ADMIN' ? 'ADMIN' : 'USER',
  };
};

const userService = {
  getAllUsers: async (): Promise<User[]> => {
    try {
      console.log('userService.getAllUsers -> fetching /users');
      const res = await ApiService.instance.get<any>('/users');
      // Debug: print the shape/type of the response without altering it
      try {
        const data = res?.data;
        const t = Array.isArray(data) ? 'array' : typeof data;
        if (Array.isArray(data)) {
          console.log('userService.getAllUsers -> received array, length=', data.length);
        } else if (data && typeof data === 'object') {
          console.log('userService.getAllUsers -> received object with keys:', Object.keys(data).slice(0, 20));
        } else {
          // primitive or unexpected
          console.log('userService.getAllUsers -> received unexpected data type:', t, 'value preview:', String(data).slice(0, 200));
        }
      } catch (previewErr) {
        console.warn('userService.getAllUsers -> could not preview response data', previewErr);
      }

      // Normalize response to frontend User type
      const raw = res.data;
      if (!Array.isArray(raw)) {
        return [];
      }
      return raw.map(normalizeUser);
    } catch (error: any) {
      console.error('userService.getAllUsers -> error', error?.response ?? error);
      throw error;
    }
  },

  getUserById: async (id: number): Promise<User> => {
    try {
      console.log('userService.getUserById -> fetching /users/' + id);
      const res = await ApiService.instance.get(`/users/${id}`);
      return normalizeUser(res.data);
    } catch (error: any) {
      console.error('userService.getUserById -> error', error?.response ?? error);
      throw error;
    }
  },

  updateUser: async (id: number, payload: UpdateUserRequest): Promise<User> => {
    try {
      const requestBody: Record<string, unknown> = {};

      (['name', 'email', 'cpf', 'phoneNumber', 'address', 'type', 'password'] as const).forEach((key) => {
        const value = (payload as Record<string, unknown>)[key];
        if (value !== undefined && value !== null && value !== '') {
          requestBody[key] = value;
        }
      });

      console.log('userService.updateUser -> updating user', id, 'payload keys:', Object.keys(requestBody));
      if (typeof requestBody.address === 'string') {
        requestBody.address = serializeAddress(sanitizeAddressParts(parseAddress(requestBody.address)));
      }

      const res = await ApiService.instance.put(`/users/${id}` , requestBody);
      return normalizeUser(res.data);
    } catch (error: any) {
      console.error('userService.updateUser -> error', error?.response ?? error);
      throw error;
    }
  },
};

export default userService;
