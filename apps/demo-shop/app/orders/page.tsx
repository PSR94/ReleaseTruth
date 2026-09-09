export default function OrdersPage() {
  return (
    <section className="page-stack narrow">
      <div className="page-header"><span className="eyebrow">Orders</span><h1>Order history</h1><p>Recent purchases and fulfillment status.</p></div>
      <div className="order-card"><div><span className="eyebrow">TS-1048 · Sep 5</span><h2>Signal Lamp</h2><p>1 item · $89.00</p></div><span className="pill success">Delivered</span></div>
      <div className="order-card"><div><span className="eyebrow">TS-1021 · Aug 14</span><h2>Trace Mug</h2><p>2 items · $68.00</p></div><span className="pill">Archived</span></div>
    </section>
  );
}
