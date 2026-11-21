import mongoose from 'mongoose';

const movementSchema = new mongoose.Schema({
  type: { type: String, enum: ['import', 'usage', 'adjustment'], required: true },
  quantity: { type: Number, required: true },
  note: { type: String, default: '' },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
}, { _id: true });

const inventoryItemSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  unit: { type: String, required: true, trim: true },
  currentStock: { type: Number, default: 0, min: 0 },
  minimumStock: { type: Number, default: 0, min: 0 },
  supplier: { type: String, default: '', trim: true },
  isActive: { type: Boolean, default: true },
  movements: { type: [movementSchema], default: [] }
}, { timestamps: true });

inventoryItemSchema.index({ isActive: 1, currentStock: 1 });

export const InventoryItem = mongoose.model('InventoryItem', inventoryItemSchema);

