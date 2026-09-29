// Run the compiled copy from .shop-worker; never seed or replace the production DB.
const { shopDb, reconcileOrder } = require("./shop-service.js");
let stop = false;
process.on("SIGTERM", () => {
  stop = true;
});
process.on("SIGINT", () => {
  stop = true;
});
async function tick() {
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
