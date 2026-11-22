import { redis } from '../config/database.js';
import { DiningTable } from '../models/DiningTable.js';
import { Order } from '../models/Order.js';
import { Reservation } from '../models/Reservation.js';
import { TableSession } from '../models/TableSession.js';
import { AppError } from '../utils/errors.js';

// Called only after a cashier's payment receipt has been durably recorded.
// Replays are safe: the closed session can be reconciled without a second close event.
export async function finishPaidTableSession({ sessionId, actorId }) {
  const session = await TableSession.findById(sessionId);
  if (!session) throw new AppError(404, 'Không tìm thấy phiên bàn');
  if (session.paymentState !== 'paid') {
    throw new AppError(409, 'Chỉ tự động trả bàn sau khi đã ghi nhận thanh toán');
  }

  const remaining = await Order.exists({
    tableSession: session._id,
    status: { $ne: 'cancelled' },
    $or: [{ status: { $ne: 'completed' } }, { paymentStatus: { $ne: 'paid' } }]
  });
  if (remaining) throw new AppError(409, 'Bàn vẫn có món chưa phục vụ hoặc chưa thanh toán');

  const closed = await TableSession.findOneAndUpdate(
    { _id: session._id, status: 'active', paymentState: 'paid' },
    {
      $set: { status: 'closed', closedAt: new Date(), closedBy: actorId },
      $push: { activity: {
        action: 'close', by: actorId,
        detail: 'Tự động trả bàn sau khi xác nhận thanh toán'
      } }
    },
    { new: true }
  );

  // A previous response may have failed between creating the receipt and
  // releasing the table. Reconcile the same session rather than double-closing.
  if (!closed && session.status !== 'closed') {
    throw new AppError(409, 'Phiên bàn thay đổi trong quá trình thanh toán');
  }
  if (session.reservation) {
    await Reservation.updateOne(
      { _id: session.reservation, status: 'seated' },
      {
        $set: { status: 'completed' },
        $push: { statusHistory: { status: 'completed', changedBy: actorId } }
      }
    );
  }

  const now = Date.now();
  const nextReservation = await Reservation.findOne({
    table: session.table,
    status: 'confirmed',
    reservedAt: {
      $gte: new Date(now - 30 * 60 * 1000),
      $lte: new Date(now + 30 * 60 * 1000)
    }
  }).sort({ reservedAt: 1 }).select('_id').lean();
  const tableStatus = nextReservation ? 'reserved' : 'available';

  // Never release a table if an unrelated new active session already exists.
  if (!(await TableSession.exists({ table: session.table, status: 'active' }))) {
    await DiningTable.updateOne(
      { _id: session.table, status: 'occupied' },
      { $set: { status: tableStatus } }
    );
  }

  await redis.del('table:lock:' + session._id);
  return { session: closed || session, tableStatus };
}
