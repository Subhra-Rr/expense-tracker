export const accountTypes = ['Cash', 'Bank Account', 'UPI / Digital Wallet', 'Savings Account', 'Other']

export function formatAccountBalance(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount)
}
