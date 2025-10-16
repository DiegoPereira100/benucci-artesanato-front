// scripts/simulateAuth.js
// Simula a normalização de payloads/usuários e determina qual rota seria usada

function normalizeType(type) {
  if (!type) return 'USER';
  const t = type.toString().toLowerCase();
  return t === 'admin' ? 'ADMIN' : 'USER';
}

function mapPayloadToUser(payload) {
  const userRole = (payload.role || payload.type || '').toString().toLowerCase() === 'admin' ? 'ADMIN' : 'USER';
  return {
    id: payload.id || Date.now(),
    email: payload.sub || payload.email || 'unknown',
    name: payload.name || payload.email || '',
    type: userRole,
    cpf: payload.cpf || '',
    phoneNumber: payload.phoneNumber || '',
    address: payload.address || '',
  };
}

function getRedirect(user) {
  if (!user) return 'NO_REDIRECT';
  return user.type === 'ADMIN' ? '/(tabs)/admin' : '/(tabs)/products';
}

const cases = [
  { name: 'JWT admin role', payload: { id: 1, role: 'admin', sub: 'admin@example.com', name: 'Admin' } },
  { name: 'JWT customer role', payload: { id: 2, role: 'customer', sub: 'cust@example.com', name: 'Customer' } },
  { name: 'JWT no role', payload: { id: 3, sub: 'norole@example.com', name: 'NoRole' } },
  { name: 'Response user ADMIN uppercase', payload: { id: 4, type: 'ADMIN', email: 'A@ex', name: 'A' } },
  { name: 'Response user CUSTOMER old', payload: { id: 5, type: 'CUSTOMER', email: 'C@ex', name: 'C' } },
  { name: 'Response user admin lowercase', payload: { id: 6, type: 'admin', email: 'a2@ex', name: 'a2' } },
];

for (const c of cases) {
  const u = mapPayloadToUser(c.payload);
  console.log('Case:', c.name);
  console.log('Input:', c.payload);
  console.log('Mapped user.type:', u.type);
  console.log('Redirect:', getRedirect(u));
  console.log('---');
}
