import { Promotion } from '../models/Promotion.js';
import { AppError } from '../utils/errors.js';

export async function calculatePromotion(code, subtotal) {
  if (!code) return { promotion: null, discountAmount: 0 };
  const now = new Date();
  const promotion = await Promotion.findOne({
    code: code.trim().toUpperCase(),
    isActive: true,
    startAt: { $lte: now },
    endAt: { $gte: now }
  });
  if (!promotion) throw new AppError(400, 'Mã khuyến mãi không hợp lệ hoặc đã hết hạn');
  if (promotion.usageLimit && promotion.usedCount >= promotion.usageLimit) {
    throw new AppError(400, 'Mã khuyến mãi đã hết lượt sử dụng');
  }
  if (subtotal < promotion.minOrderValue) {
    throw new AppError(400, `Đơn hàng tối thiểu ${promotion.minOrderValue.toLocaleString('vi-VN')}đ`);
  }
  let discountAmount = promotion.discountType === 'percent'
    ? subtotal * promotion.discountValue / 100
    : promotion.discountValue;
  if (promotion.maxDiscount) discountAmount = Math.min(discountAmount, promotion.maxDiscount);
  discountAmount = Math.min(subtotal, Math.round(discountAmount));
  return { promotion, discountAmount };
}

