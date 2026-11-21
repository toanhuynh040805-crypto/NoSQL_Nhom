import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const root = 'http://127.0.0.1:5000';
async function request(method, path, token, body, expected = 200) {
  const response = await fetch(root + path, {
    method,
    headers: {
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
  assert.equal(
    response.status, expected,
    method + ' ' + path + ': expected HTTP ' + expected + ', got ' + response.status + ': ' + JSON.stringify(data)
  );
  return data;
}
const login = async email => request('POST', '/api/auth/login', null, { email, password: '123456' });

const staff = await login('staff@quanan.vn');
const cashier = await login('thungan@quanan.vn');
const kitchen = await login('bep@quanan.vn');
const admin = await login('admin@quanan.vn');
const customer = await login('khach@quanan.vn');
const st = staff.token, ct = cashier.token, kt = kitchen.token, at = admin.token, ut = customer.token;

await request('GET', '/api/staff/tables', ut, undefined, 403);
await request('GET', '/api/staff/tables', kt, undefined, 403);

const floors = await request('GET', '/api/staff/tables', st);
const candidates = floors.tables.filter(t => t.status === 'available' && t.capacity >= 2);
assert.ok(candidates.length >= 4, 'need available sample tables');
const [table, dest, other, booked] = candidates;
const menu = await request('GET', '/api/foods?limit=50', st);
assert.ok(menu.foods.length > 0, 'menu should be seeded');

const opened = await request('POST', '/api/staff/tables/' + table._id + '/open', st, {
  guestCount: 2, customerName: 'Khách thử nghiệm CI'
}, 201);
const sessionId = opened.session._id;
const details = await request('GET', '/api/staff/sessions/' + sessionId, st);
assert.equal(details.lock.ownerId, staff.user.id, 'lock owner is publicUser.id');
await request('POST', '/api/staff/tables/' + table._id + '/open', st, { guestCount: 2 }, 409);
await request('PUT', '/api/tables/' + table._id, at, { status: 'available' }, 409);

const requestId = randomUUID();
const item = { foodId: menu.foods[0]._id, quantity: 2, note: 'Không cay' };
const first = await request('POST', '/api/staff/sessions/' + sessionId + '/orders', st, {
  items: [item], priority: 'urgent', clientRequestId: requestId
}, 201);
assert.equal(first.order.source, 'staff');
assert.equal(first.order.priority, 'urgent');
const again = await request('POST', '/api/staff/sessions/' + sessionId + '/orders', st, {
  items: [item], priority: 'urgent', clientRequestId: requestId
});
assert.equal(again.duplicate, true, 'replayed order request must be idempotent');
const orderId = first.order._id;
const adjusted = await request('PATCH', '/api/staff/orders/' + orderId + '/items/0', st, {
  quantity: 3
});
assert.equal(adjusted.order.items[0].quantity, 3);

await request('PATCH', '/api/orders/' + orderId + '/status', kt, { status: 'preparing' });
await request('PATCH', '/api/staff/orders/' + orderId + '/items/0', st, { quantity: 4 }, 409);
await request('PATCH', '/api/orders/' + orderId + '/status', kt, { status: 'ready' });
await request('PATCH', '/api/orders/' + orderId + '/status', st, { status: 'completed' });
await request('PATCH', '/api/orders/' + orderId + '/payment', ct, { paymentStatus: 'paid' });
await request('PATCH', '/api/staff/sessions/' + sessionId + '/close', ct, undefined, 423);
await request('DELETE', '/api/staff/sessions/' + sessionId + '/lock', st, undefined, 204);
const closed = await request('PATCH', '/api/staff/sessions/' + sessionId + '/close', ct);
assert.equal(closed.session.status, 'closed');
const after = await request('GET', '/api/staff/tables', st);
assert.equal(after.tables.find(t => t._id === table._id)?.status, 'available');

const second = await request('POST', '/api/staff/tables/' + other._id + '/open', st, {
  guestCount: 2
}, 201);
await request('PATCH', '/api/staff/sessions/' + second.session._id + '/transfer', st, {
  destinationTableId: dest._id
});
const transferred = await request('GET', '/api/staff/sessions/' + second.session._id, st);
assert.equal(transferred.session.tableNumber, dest.name);
await request('DELETE', '/api/staff/sessions/' + second.session._id + '/lock', st, undefined, 204);
await request('PATCH', '/api/staff/sessions/' + second.session._id + '/close', ct);

const date = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
const reserve = await request('POST', '/api/reservations', ut, {
  reservedAt: date, guestCount: 2, phone: '0988123456'
}, 201);
await request('PATCH', '/api/reservations/' + reserve.reservation._id + '/status', at, {
  status: 'confirmed', tableId: booked._id
});
const fromFuture = await request('GET', '/api/staff/tables', st);
assert.equal(fromFuture.tables.find(t => t._id === booked._id)?.status, 'available', 'future bookings must not block table now');

const duplicateBooking = await request('POST', '/api/reservations', ut, {
  reservedAt: date, guestCount: 2, phone: '0988123456'
}, 201);
await request('PATCH', '/api/reservations/' + duplicateBooking.reservation._id + '/status', at, {
  status: 'confirmed', tableId: booked._id
}, 409);
await request('PATCH', '/api/reservations/' + reserve.reservation._id + '/cancel', ut);
console.log('PASS: staff table sessions, Redis lock, idempotent orders, kitchen, cashier, transfer, reservation conflict.');
