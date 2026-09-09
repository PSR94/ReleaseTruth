export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  accent: string;
}

export const products: Product[] = [
  { id: 'signal-lamp', name: 'Signal Lamp', description: 'A dimmable desk lamp with warm and task-light modes.', price: 89, category: 'Desk', accent: 'amber' },
  { id: 'trace-mug', name: 'Trace Mug', description: 'Double-wall ceramic mug for long debugging sessions.', price: 34, category: 'Kitchen', accent: 'blue' },
  { id: 'branch-notebook', name: 'Branch Notebook', description: 'Lay-flat dot grid notebook with indexed sections.', price: 24, category: 'Desk', accent: 'green' },
  { id: 'diff-tote', name: 'Diff Tote', description: 'Heavy canvas carryall with reinforced handles.', price: 42, category: 'Carry', accent: 'rose' },
  { id: 'baseline-stand', name: 'Baseline Stand', description: 'Machined aluminum phone stand with cable channel.', price: 58, category: 'Desk', accent: 'violet' },
  { id: 'release-bottle', name: 'Release Bottle', description: 'Insulated stainless bottle, 650 ml.', price: 39, category: 'Carry', accent: 'cyan' }
];

export function searchProducts(query: string): Product[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return products;
  return products.filter((product) =>
    `${product.name} ${product.description} ${product.category}`.toLowerCase().includes(normalized),
  );
}
