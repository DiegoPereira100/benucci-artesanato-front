import ApiService from './api';
import { UpdateUserRequest, User, UserRole } from '@/types/auth';
import { parseAddress, sanitizeAddressParts, serializeAddress } from '../utils/address';

const normalizeEmail = (value?: string | null): string => (value ?? '').trim().toLowerCase();
const emailIdCache = new Map<string, number>();
const probedUserIds = new Set<number>();
const MAX_USER_ID_PROBE = 800;

const cacheUserId = (email?: string | null, id?: number) => {
  const normalized = normalizeEmail(email);
  if (!normalized || !id || id <= 0) return;
  emailIdCache.set(normalized, id);
};

const removeIdFromCache = (id: number) => {
  for (const [email, cachedId] of emailIdCache.entries()) {
    if (cachedId === id) {
      emailIdCache.delete(email);
      break;
    }
  }
};

const normalizeRole = (value?: string): UserRole => {
  if (!value) {
    return 'USER';
  }
  const upper = value.toString().toUpperCase().replace('ROLE_', '');
  return upper === 'ADMIN' ? 'ADMIN' : 'USER';
};

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
      role: 'USER',
    };
  }

  const normalizedType = normalizeRole(data.role ?? data.type);
  const rawId = Number(data.id) || 0;
  if (rawId > 0) {
    cacheUserId(data.email, rawId);
  }
  const cachedId = emailIdCache.get(normalizeEmail(data.email)) ?? rawId;

  return {
    id: cachedId,
    name: data.name ?? '',
    email: data.email ?? '',
    cpf: data.cpf ?? '',
    phoneNumber: data.phoneNumber ?? '',
    address: serializeAddress(parseAddress(data.address)),
    type: normalizedType,
    role: normalizedType,
  };
};

const fetchUserSkeleton = async (id: number): Promise<User | null> => {
  try {
    const res = await ApiService.instance.get(`/users/${id}`);
    probedUserIds.add(id);
    const normalized = normalizeUser(res.data);
    const resolvedId = normalized.id && normalized.id > 0 ? normalized.id : id;
    cacheUserId(normalized.email, resolvedId);
    return { ...normalized, id: resolvedId };
  } catch (error: any) {
    if (error?.response?.status === 404) {
      probedUserIds.add(id);
      return null;
    }
    throw error;
  }
};

const hydrateUserIds = async (users: User[]): Promise<User[]> => {
  const pending = new Set(
    users
      .filter((user) => !user.id || user.id <= 0)
      .map((user) => normalizeEmail(user.email))
      .filter((email) => email && !emailIdCache.has(email)),
  );

  if (pending.size === 0) {
    return users.map((user) => {
      const cachedId = emailIdCache.get(normalizeEmail(user.email));
      return cachedId ? { ...user, id: cachedId } : user;
    });
  }

  // Fallback: Probe IDs sequentially to find missing users
  // This is necessary because the backend UserDTO does not include the ID field,
  // so we must infer it from the URL /users/{id}.
  // We suppress 404 errors to avoid console spam.
  let candidate = 1;
  const foundEmails = new Set<string>();
  const MAX_PROBE = 200; // Limit probing to avoid excessive requests

  // Create batches of requests
  while (candidate <= MAX_PROBE && foundEmails.size < pending.size) {
    const batchSize = 10;
    const promises = [];
    
    for (let i = 0; i < batchSize; i++) {
      const idToProbe = candidate + i;
      if (idToProbe > MAX_PROBE) break;
      
      if (!probedUserIds.has(idToProbe)) {
        promises.push(
          ApiService.instance.get(`/users/${idToProbe}`)
            .then((res) => {
              probedUserIds.add(idToProbe);
              const u = normalizeUser(res.data);
              // Explicitly cache the ID we just probed
              if (u.email) {
                cacheUserId(u.email, idToProbe);
                foundEmails.add(normalizeEmail(u.email));
              }
            })
            .catch((err) => {
              probedUserIds.add(idToProbe);
              // Suppress 404s
              if (err?.response?.status !== 404) {
                console.warn(`Probe failed for ID ${idToProbe}`, err);
              }
            })
        );
      }
    }

    await Promise.all(promises);
    candidate += batchSize;
  }

  return users.map((user) => {
    const cachedId = emailIdCache.get(normalizeEmail(user.email));
    return cachedId ? { ...user, id: cachedId } : user;
  });
};

const resolveUserIdByEmail = async (email: string): Promise<number | null> => {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  if (emailIdCache.has(normalized)) {
    return emailIdCache.get(normalized)!;
  }

  try {
    const encoded = encodeURIComponent(normalized);
    const res = await ApiService.instance.get(`/users/email/${encoded}`);
    const user = normalizeUser(res.data);
    if (user.id && user.id > 0) {
      return user.id;
    }
  } catch (error) {
    // Ignore error
  }

  return emailIdCache.get(normalized) ?? null;
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
      const normalizedList = raw.map(normalizeUser);
      return await hydrateUserIds(normalizedList);
    } catch (error: any) {
      console.error('userService.getAllUsers -> error', error?.response ?? error);
      throw error;
    }
  },

  getUserById: async (id: number): Promise<User> => {
    try {
      console.log('userService.getUserById -> fetching /users/' + id);
      const res = await ApiService.instance.get(`/users/${id}`);
      probedUserIds.add(id);
      const normalized = normalizeUser(res.data);
      const resolvedId = normalized.id && normalized.id > 0 ? normalized.id : id;
      cacheUserId(normalized.email, resolvedId);
      return { ...normalized, id: resolvedId };
    } catch (error: any) {
      console.error('userService.getUserById -> error', error?.response ?? error);
      throw error;
    }
  },

  getUserByEmail: async (email: string): Promise<User> => {
    try {
      const encoded = encodeURIComponent(email);
      console.log('userService.getUserByEmail -> fetching /users/email/' + encoded);
      const res = await ApiService.instance.get(`/users/email/${encoded}`);
      const normalized = normalizeUser(res.data);
      const cachedId = emailIdCache.get(normalizeEmail(email));
      if (cachedId && cachedId > 0) {
        return { ...normalized, id: cachedId };
      }
      return normalized;
    } catch (error: any) {
      console.error('userService.getUserByEmail -> error', error?.response ?? error);
      throw error;
    }
  },

  updateUser: async (id: number, payload: UpdateUserRequest): Promise<User> => {
    try {
      const requestBody: Record<string, unknown> = {};

      (['name', 'email', 'cpf', 'phoneNumber', 'address', 'password'] as const).forEach((key) => {
        const value = (payload as Record<string, unknown>)[key];
        if (value !== undefined && value !== null && value !== '') {
          requestBody[key] = value;
        }
      });

      const requestedRole = (payload.role ?? payload.type) as UserRole | undefined;
      if (requestedRole) {
        requestBody.role = requestedRole === 'ADMIN' ? 'admin' : 'user';
      }

      console.log('userService.updateUser -> updating user', id, 'payload keys:', Object.keys(requestBody));
      if (typeof requestBody.address === 'string') {
        requestBody.address = serializeAddress(sanitizeAddressParts(parseAddress(requestBody.address)));
      }

      const res = await ApiService.instance.put(`/users/${id}` , requestBody);
      const normalized = normalizeUser(res.data);
      const resolvedId = normalized.id && normalized.id > 0 ? normalized.id : id;
      cacheUserId(normalized.email || payload.email, resolvedId);
      return { ...normalized, id: resolvedId };
    } catch (error: any) {
      console.error('userService.updateUser -> error', error?.response ?? error);
      throw error;
    }
  },

  deleteUser: async (id: number): Promise<void> => {
    try {
      console.log('userService.deleteUser -> deleting user', id);
      await ApiService.instance.delete(`/users/${id}`);
      removeIdFromCache(id);
    } catch (error: any) {
      console.error('userService.deleteUser -> error', error?.response ?? error);
      throw error;
    }
  },

  resolveUserIdByEmail,
};

export default userService;
