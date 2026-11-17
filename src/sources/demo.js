export const DEMO = {
  path: 'src/cart.ts',
  commits: [
    { short: 'a41c2e0', author: 'aa', date: '2026-11-10', msg: 'feat: add cart total', code:
`export function total(items) {
  let sum = 0;
  for (let i = 0; i < items.length; i++) {
    sum += items[i].price;
  }
  return sum;
}` },
    { short: 'b7d9f13', author: 'aa', date: '2026-11-12', msg: 'refactor: use reduce instead of a loop', code:
`export function total(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}` },
    { short: 'c02e88a', author: 'aa', date: '2026-11-14', msg: 'feat: support item quantities', code:
`export function total(items) {
  return items.reduce((sum, item) => sum + item.price * item.qty, 0);
}` },
    { short: 'd5f6a21', author: 'aa', date: '2026-11-16', msg: 'feat: types and tax', code:
`type Item = { price: number; qty: number };

export function total(items: Item[], tax = 0.12): number {
  const sum = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  return sum * (1 + tax);
}` },
  ],
};
