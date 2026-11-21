import mongoose from 'mongoose';

const diningTableSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  area: { type: String, required: true, trim: true },
  capacity: { type: Number, required: true, min: 1, max: 50 },
  status: {
    type: String,
    enum: ['available', 'occupied', 'reserved', 'cleaning', 'inactive'],
    default: 'available'
  },
  description: { type: String, default: '' }
}, { timestamps: true });

diningTableSchema.index({ area: 1, status: 1 });

export const DiningTable = mongoose.model('DiningTable', diningTableSchema);

