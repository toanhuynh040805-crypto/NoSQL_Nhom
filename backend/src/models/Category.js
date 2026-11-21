import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  slug: { type: String, required: true, unique: true, trim: true },
  type: { type: String, enum: ['food', 'drink'], default: 'food' },
  description: { type: String, default: '' }
}, { timestamps: true });

export const Category = mongoose.model('Category', categorySchema);

