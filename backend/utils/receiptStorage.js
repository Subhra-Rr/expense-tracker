const crypto = require('crypto')
const fs = require('fs/promises')
const path = require('path')

const receiptDirectory = path.resolve(__dirname, '../storage/receipts')
const maxReceiptBytes = 5 * 1024 * 1024

function detectImage(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { contentType: 'image/jpeg', extension: 'jpg' }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { contentType: 'image/png', extension: 'png' }
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return { contentType: 'image/webp', extension: 'webp' }
  return null
}

async function saveReceipt(buffer, image) {
  await fs.mkdir(receiptDirectory, { recursive: true })
  const storageName = `${crypto.randomUUID()}.${image.extension}`
  await fs.writeFile(path.join(receiptDirectory, storageName), buffer, { flag: 'wx' })
  return { storageName, contentType: image.contentType, size: buffer.length }
}

async function removeReceipt(storageName) {
  if (!storageName || path.basename(storageName) !== storageName) return
  await fs.rm(path.join(receiptDirectory, storageName), { force: true })
}

function receiptPath(storageName) { return path.join(receiptDirectory, path.basename(storageName)) }

module.exports = { detectImage, maxReceiptBytes, receiptPath, removeReceipt, saveReceipt }
