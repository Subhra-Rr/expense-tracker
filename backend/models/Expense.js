const mongoose = require('mongoose')

const categories = ['Food', 'Transport', 'Shopping', 'Bills', 'Education', 'Health', 'Entertainment', 'Other']
const paymentMethods = ['Cash', 'Card', 'UPI', 'Bank Transfer', 'Other']

const expenseSchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: true,
      min: 0.01,
      max: 1000000000000,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 80,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 160,
    },
    date: {
      type: Date,
      required: true,
    },
    paymentMethod: {
      type: String,
      required: true,
      enum: paymentMethods,
    },
    account: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      index: true,
    },
    idempotencyKey: {
      type: String,
      select: false,
      maxlength: 120,
    },
    recurringRule: { type: mongoose.Schema.Types.ObjectId, ref: 'RecurringRule', index: true },
    recurringOccurrenceKey: { type: String, index: true },
    merchant: {
      type: String,
      trim: true,
      maxlength: 160,
      default: '',
    },
    tags: {
      type: [{ type: String, trim: true, maxlength: 40 }],
      validate: [{ validator: (value) => value.length <= 10, message: 'A maximum of 10 tags is allowed' }],
      default: [],
    },
    receipt: { type: mongoose.Schema.Types.ObjectId, ref: 'Receipt', index: true },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
      select: false,
    },
  },
  { timestamps: true },
)

expenseSchema.index({ user: 1, idempotencyKey: 1 }, { unique: true, sparse: true })
expenseSchema.index({ user: 1, date: -1, createdAt: -1 })

module.exports = { Expense: mongoose.model('Expense', expenseSchema), categories, paymentMethods }
