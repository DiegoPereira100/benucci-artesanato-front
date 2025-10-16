import ApiService from './api';
import { User } from '@/types/auth';

const userService = {
  getAllUsers: async (): Promise<User[]> => {
    try {
      console.log('userService.getAllUsers -> fetching /users');
      const res = await ApiService.instance.get<User[]>('/users');
      console.log('userService.getAllUsers -> received', res.data.length, 'users');
      // backend returns full User objects; rely on type
      return res.data;
    } catch (error: any) {
      console.error('userService.getAllUsers -> error', error?.response ?? error);
      throw error;
    }
  },
};

export default userService;
