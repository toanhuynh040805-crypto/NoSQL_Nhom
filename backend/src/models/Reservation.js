import mongoose from 'mongoose';

const reservationSchema = new mongoose.Schema({
  reservationCode: { type: String, required: true, unique: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  customerName: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  reservedAt: { type: Date, required: true },
  guestCount: { type: Number, required: true, min: 1, max: 50 },
  table: { type: mongoose.Schema.Types.ObjectId, ref: 'DiningTable' },
  areaPreference: { type: String, default: '', trim: true },
  note: { type: String, default: '', maxlength: 300 },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no-show'],
    default: 'pending'
  },
  statusHistory: [{
    status: String,
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }]
}, { timestamps: true });

reservationSchema.index({ customer: 1, reservedAt: -1 });
reservationSchema.index({ reservedAt: 1, status: 1 });

export const Reservation = mongoose.model('Reservation', reservationSchema);

