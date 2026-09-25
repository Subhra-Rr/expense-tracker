const mongoose = require('mongoose')

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true, select: false },
    uniqueKey: { type: String, required: true, unique: true, maxlength: 240 },
    type: { type: String, required: true, enum: ['budget_threshold', 'recurring_due'] },
    title: { type: String, required: true, maxlength: 160 },
    message: { type: String, required: true, maxlength: 500 },
    readAt: { type: Date, default: null, index: true },
    dismissedAt: { type: Date, default: null, index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
)

notificationSchema.index({ user: 1, dismissedAt: 1, createdAt: -1 })
notificationSchema.index({ user: 1, readAt: 1, dismissedAt: 1 })

module.exports = mongoose.model('Notification', notificationSchema)
