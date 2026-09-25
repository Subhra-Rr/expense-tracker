const mongoose = require('mongoose')

const customCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    nameNormalized: { type: String, required: true, lowercase: true, trim: true },
    type: { type: String, required: true, enum: ['expense', 'income'] },
    archived: { type: Boolean, default: false, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true },
)

customCategorySchema.index({ user: 1, type: 1, nameNormalized: 1 }, { unique: true })
customCategorySchema.index({ user: 1, type: 1, archived: 1, name: 1 })

module.exports = mongoose.model('CustomCategory', customCategorySchema)
