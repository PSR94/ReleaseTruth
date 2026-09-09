#!/usr/bin/env node

const variant = process.env.TRUTHSHOP_VARIANT === 'regression' ? 'regression' : 'good';
const [command = 'receipt'] = process.argv.slice(2);
if (command !== 'receipt') {
  process.stderr.write(`Unknown command: ${command}\n`);
  process.exit(64);
}
const output = {
  orderId: 'ord_demo_1049',
  total: 89,
  currency: 'USD',
  status: 'created',
};
process.stdout.write(`${JSON.stringify(output)}\n`);
process.exit(variant === 'good' ? 0 : 1);
