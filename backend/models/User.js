const mongoose = require('mongoose')

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
    notificationPreferences: {
      budgetAlerts: { type: Boolean, default: true },
      recurringAlerts: { type: Boolean, default: true },
    },
    preferences: {
      currency: { type: String, enum: ['INR'], default: 'INR' },
      dateFormat: { type: String, enum: ['DD/MM/YYYY', 'YYYY-MM-DD', 'MMM D, YYYY'], default: 'DD/MM/YYYY' },
      dashboardMonth: { type: String, enum: ['current', 'previous'], default: 'current' },
      theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
    },
  },
  { timestamps: true },
)

module.exports = mongoose.model('User', userSchema)
