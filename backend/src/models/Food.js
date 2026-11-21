import mongoose from 'mongoose';

const foodSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, trim: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true, min: 0 },
  unit: { type: String, default: 'Phần' },
  imageUrl: { type: String, default: '' },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  tags: [{ type: String, trim: true }],
  isAvailable: { type: Boolean, default: true },
  soldCount: { type: Number, default: 0, min: 0 },
  ratingAverage: { type: Number, default: 0, min: 0, max: 5 },
  ratingCount: { type: Number, default: 0, min: 0 }
}, { timestamps: true });

foodSchema.index({ name: 'text', description: 'text', tags: 'text' });
foodSchema.index({ category: 1, isAvailable: 1 });

export const Food = mongoose.model('Food', foodSchema);

