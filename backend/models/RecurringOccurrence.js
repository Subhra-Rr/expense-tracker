const mongoose = require('mongoose')

const occurrenceSchema = new mongoose.Schema(
  {
    rule: { type: mongoose.Schema.Types.ObjectId, ref: 'RecurringRule', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true, select: false },
    occurrenceKey: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    transactionType: { type: String, required: true, enum: ['Expense', 'Income'] },
    scheduledDate: { type: Date, required: true },
    status: { type: String, enum: ['generated', 'failed'], required: true },
    transaction: { type: mongoose.Schema.Types.ObjectId },
    error: { type: String, maxlength: 500 },
  },
  { timestamps: true },
)

occurrenceSchema.index({ user: 1, scheduledDate: -1 })

module.exports = mongoose.model('RecurringOccurrence', occurrenceSchema)
