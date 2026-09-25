const assert = require('node:assert/strict')
const test = require('node:test')
const { calculateBudgetStats } = require('../controllers/budgetController')
const { getListOptions, validateExpenseInput } = require('../controllers/expenseController')
const { latestDue, nextDateKey } = require('../utils/recurringScheduler')

test('rejects impossible expense dates', () => {
  const error = validateExpenseInput({
    amount: 120,
    category: 'Food',
    description: 'Lunch',
    date: '2025-02-30',
    paymentMethod: 'Cash',
  })

  assert.equal(error, 'Choose a valid date')
})

test('accepts a valid expense and normalizes list date filters', () => {
  const error = validateExpenseInput({
    amount: 120,
    category: 'Food',
    description: 'Lunch',
    date: '2024-02-29',
    paymentMethod: 'Cash',
  })
  const options = getListOptions({ startDate: '2024-02-29', endDate: '2024-03-01' })

  assert.equal(error, null)
  assert.equal(options.error, undefined)
  assert.equal(options.filters.date.$gte.toISOString(), '2024-02-29T00:00:00.000Z')
  assert.equal(options.filters.date.$lt.toISOString(), '2024-03-02T00:00:00.000Z')
})

test('calculates budget statistics correctly', () => {
  assert.deepEqual(calculateBudgetStats(10000, 2500), {
    budget: 10000,
    spent: 2500,
    remaining: 7500,
    percentageUsed: 25,
  })
})

test('calculates recurring calendar dates without December rollover bugs', () => {
  assert.equal(nextDateKey('2025-01-31', 'Monthly', '2025-01-31'), '2025-02-28')
  assert.equal(nextDateKey('2025-12-31', 'Monthly', '2025-12-31'), '2026-01-31')
  assert.equal(nextDateKey('2024-02-29', 'Yearly', '2024-02-29'), '2025-02-28')
})

test('collapses missed recurring dates to one safe occurrence', () => {
  assert.deepEqual(latestDue('2024-01-15', 'Monthly', '2024-01-15', '2024-05-20'), {
    latest: '2024-05-15',
    next: '2024-06-15',
    skipped: 4,
  })
})
