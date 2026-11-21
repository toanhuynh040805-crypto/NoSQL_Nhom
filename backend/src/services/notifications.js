import { Notification } from '../models/Notification.js';

export async function notifyUser(userId, payload) {
  return Notification.create({ user: userId, ...payload });
}

export async function notifyRoles(roles, payload) {
  const { User } = await import('../models/User.js');
  const users = await User.find({ role: { $in: roles }, isActive: true }).select('_id').lean();
  if (!users.length) return [];
  return Notification.insertMany(users.map(user => ({ user: user._id, ...payload })));
}

