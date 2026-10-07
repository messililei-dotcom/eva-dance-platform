// Run the compiled copy from .shop-worker; never seed or replace the production DB.
const { shopDb, reconcileOrder } = require("./shop-service.js");
const {ensureExclusive} = require('./exclusive-orders.js');
const {reconcileExclusiveRefund} = require('./exclusive-refunds.js');
let stop = false;
process.on("SIGTERM", () => {
  stop = true;
});
process.on("SIGINT", () => {
  stop = true;
});
async function tick() {
  const refunds=shopDb(db=>{ensureExclusive(db);return db.prepare("SELECT id FROM exclusive_refunds WHERE status='pending' ORDER BY created_at LIMIT 100").all()});
  for(const refund of refunds){if(stop)return;try{await reconcileExclusiveRefund(refund.id)}catch(error){console.error('[exclusive-refund]',refund.id,error.name || 'Error')}}
  const orders = shopDb((db) =>
    db
      .prepare(
        "SELECT id FROM shop_online_orders WHERE status IN ('pending','refunding') ORDER BY updated_at LIMIT 100",
      )
      .all(),
  );
  for (const order of orders) {
    if (stop) return;
    try {
      await reconcileOrder(order.id);
    } catch (error) {
      console.error("[shop-reconcile]", order.id, error.name || "Error");
    }
    // Rotate unresolved rows so one faulty order cannot starve the queue.
    shopDb((db) =>
      db
        .prepare("UPDATE shop_online_orders SET updated_at=? WHERE id=?")
        .run(Date.now(), order.id),
    );
  }
}
(async () => {
  while (!stop) {
    try {
      await tick();
    } catch (error) {
      console.error("[shop-worker]", error.name || "Error");
    }
    if (!stop) await new Promise((resolve) => setTimeout(resolve, 30000));
  }
})();
