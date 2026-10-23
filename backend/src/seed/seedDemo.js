require("dotenv").config();
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");
const Shop = require("../models/Shop");
const Rider = require("../models/Rider");
const Warehouse = require("../models/Warehouse");
const Order = require("../models/Order");
const Plan = require("../models/Plan");
const Forecast = require("../models/Forecast");
const { startOfIstDay } = require("../services/ml.service");
const { calculateRoute } = require("../services/planning.service");

// DEMO ONLY: repeatable seed accounts and synthetic Jaipur data. Do not use these credentials in production.
const demoPassword = "KiranaDemo@123";
const shopsData = [
  ["mansarovar", "Mansarovar", "Amit Sharma", 26.8540, 75.7640],
  ["malviya", "Malviya Nagar", "Riya Verma", 26.8545, 75.8050],
  ["jagatpura", "Jagatpura", "Rahul Meena", 26.8390, 75.8560],
  ["sanganer", "Sanganer", "Neha Gupta", 26.8190, 75.7760],
  ["vaishali", "Vaishali Nagar", "Karan Joshi", 26.9120, 75.7390],
  ["tonkroad", "Tonk Road", "Pooja Jain", 26.8530, 75.7920],
  ["pratapnagar", "Pratap Nagar", "Mohit Yadav", 26.7980, 75.8350],
  ["adnagar", "Adarsh Nagar", "Simran Kaur", 26.8910, 75.8180],
  ["bani park", "Bani Park", "Deepak Singh", 26.9290, 75.7950],
  ["vidhyadhar", "Vidhyadhar Nagar", "Anjali Rathore", 26.9610, 75.7790],
].map(([key, area, ownerName, lat, lng], i) => ({
  key, area, ownerName,
  name: `Demo ${area} Kirana`,
  email: `demo.shopkeeper${i + 1}@kiranapool.test`,
  phone: `90000000${String(i + 1).padStart(2, "0")}`,
  address: `${area}, Jaipur, Rajasthan`,
  location: { lat, lng },
}));
const ridersData = [
  { name: "Demo Rider Aarav", email: "demo.rider@kiranapool.test", phone: "9000000099", vehicleType: "bike", location: { lat: 26.785, lng: 75.850 } },
  { name: "Demo Rider Meera", email: "demo.rider2@kiranapool.test", phone: "9000000098", vehicleType: "scooter", location: { lat: 26.900, lng: 75.790 } },
  { name: "Demo Rider Kabir", email: "demo.rider3@kiranapool.test", phone: "9000000097", vehicleType: "bike", location: { lat: 26.840, lng: 75.780 } },
];

async function upsertUser({ name, email, role, passwordHash }) {
  return User.findOneAndUpdate({ email }, { $set: { name, role, passwordHash } }, { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true });
}

function orderDoc({ shop, warehouse, wholesaler, status, slotStart, slotEnd, items, index = 0, rider = null, plan = null, createdAt }) {
  const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  return {
    shop: shop.shop._id, warehouse: warehouse._id, createdBy: wholesaler._id,
    orderSource: "wholesaler_manual", demoSeed: true,
    customerName: shop.shop.name, customerPhone: shop.phone, deliveryAddress: shop.address,
    location: shop.location, items, totalAmount, status, deliveryWindowMin: Math.round((slotEnd - slotStart) / 60000),
    deliverySlotStart: slotStart, deliverySlotEnd: slotEnd, rider, plan,
    ...(createdAt ? { createdAt, updatedAt: createdAt } : {}),
  };
}

async function main() {
  await connectDB();
  const passwordHash = await bcrypt.hash(demoPassword, 10);
  const wholesaler = await upsertUser({ name: "Demo Jaipur Wholesaler", email: "demo.wholesaler@kiranapool.test", role: "wholesaler", passwordHash });

  const shops = [];
  for (const row of shopsData) {
    const owner = await upsertUser({ name: row.ownerName, email: row.email, role: "shopkeeper", passwordHash });
    const shop = await Shop.findOneAndUpdate(
      { owner: owner._id, name: row.name },
      { $set: { name: row.name, owner: owner._id, ownerName: row.ownerName, phone: row.phone, address: row.address, area: row.area, location: row.location, isActive: true } },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );
    shops.push({ ...row, owner, shop });
  }

  const warehouseA = await Warehouse.findOneAndUpdate(
    { owner: wholesaler._id, name: "Demo Jaipur Central Warehouse" },
    { $set: { owner: wholesaler._id, name: "Demo Jaipur Central Warehouse", supplierName: wholesaler.name, address: "Sitapura Industrial Area, Jaipur", location: { lat: 26.785, lng: 75.850 }, serviceAreas: ["Mansarovar", "Malviya Nagar", "Jagatpura", "Sanganer", "Tonk Road", "Pratap Nagar"], isActive: true } },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
  );
  const warehouseB = await Warehouse.findOneAndUpdate(
    { owner: wholesaler._id, name: "Demo Jaipur North Warehouse" },
    { $set: { owner: wholesaler._id, name: "Demo Jaipur North Warehouse", supplierName: wholesaler.name, address: "Vidhyadhar Nagar, Jaipur", location: { lat: 26.961, lng: 75.779 }, serviceAreas: ["Vaishali Nagar", "Adarsh Nagar", "Bani Park", "Vidhyadhar Nagar", "Malviya Nagar"], isActive: true } },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
  );

  const riders = [];
  for (const row of ridersData) {
    const riderUser = await upsertUser({ name: row.name, email: row.email, role: "rider", passwordHash });
    const rider = await Rider.findOneAndUpdate(
      { user: riderUser._id },
      { $set: { user: riderUser._id, name: row.name, phone: row.phone, vehicleType: row.vehicleType, location: row.location, isAvailable: true } },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );
    riders.push({ ...row, user: riderUser, rider });
  }

  // Clear only this demo wholesaler's generated data; other users/data are preserved.
  await Plan.deleteMany({ createdBy: wholesaler._id });
  await Forecast.deleteMany({ wholesaler: wholesaler._id });
  await Order.deleteMany({ demoSeed: true, createdBy: wholesaler._id });

  const today = startOfIstDay(new Date());
  const historyDocs = [];
  const slotHours = [9, 13, 18];
  for (let day = -28; day < 0; day += 1) {
    const dayStart = new Date(today.getTime() + day * 86400000);
    for (let si = 0; si < shops.length; si += 1) {
      for (let ti = 0; ti < slotHours.length; ti += 1) {
        if ((Math.abs(day) + si * 2 + ti) % (si % 3 === 0 ? 4 : 3) === 0) continue;
        const slotStart = new Date(dayStart.getTime() + slotHours[ti] * 3600000);
        const shop = shops[si];
        const quantity = 1 + ((Math.abs(day) + si + ti) % 5);
        const createdAt = new Date(slotStart.getTime() - 12 * 3600000);
        historyDocs.push(orderDoc({ shop, warehouse: si >= 4 ? warehouseB : warehouseA, wholesaler, status: "delivered", slotStart, slotEnd: new Date(slotStart.getTime() + 2 * 3600000), items: [{ name: ["Rice 25kg", "Wheat Flour 10kg", "Cooking Oil 5L", "Sugar 5kg"][ti], quantity, price: [1250, 400, 700, 250][ti] }], createdAt }));
      }
    }
  }
  const historicalOrders = await Order.insertMany(historyDocs);

  // Seed upcoming orders in shared time slots so the pooling preview has real candidates.
  const tomorrow = new Date(today.getTime() + 86400000);
  const pooledSlotStart = new Date(tomorrow.getTime() + 10 * 3600000);
  const pooledSlotEnd = new Date(pooledSlotStart.getTime() + 3 * 3600000);
  const pendingDocs = shops.slice(0, 6).map((shop, i) => orderDoc({ shop, warehouse: warehouseA, wholesaler, status: "pending", slotStart: pooledSlotStart, slotEnd: pooledSlotEnd, items: [{ name: "Wheat Flour 10kg", quantity: 2 + (i % 4), price: 400 }, { name: "Sugar 5kg", quantity: 1 + (i % 2), price: 250 }] }));
  const pendingBSlotStart = new Date(tomorrow.getTime() + 14 * 3600000);
  const pendingBSlotEnd = new Date(pendingBSlotStart.getTime() + 3 * 3600000);
  pendingDocs.push(...shops.slice(6, 10).map((shop, i) => orderDoc({ shop, warehouse: warehouseB, wholesaler, status: "pending", slotStart: pendingBSlotStart, slotEnd: pendingBSlotEnd, items: [{ name: "Cooking Oil 5L", quantity: 2 + i, price: 700 }] })));
  await Order.insertMany(pendingDocs);

  // A separate pre-planned route assigned to a rider, for wholesaler/rider dashboard demonstrations.
  const activeSlotStart = new Date(Date.now() + 60 * 60000);
  const activeSlotEnd = new Date(activeSlotStart.getTime() + 3 * 3600000);
  const activeDocs = await Order.insertMany(shops.slice(0, 4).map((shop, i) => orderDoc({ shop, warehouse: warehouseA, wholesaler, status: "pending", slotStart: activeSlotStart, slotEnd: activeSlotEnd, items: [{ name: "Rice 25kg", quantity: 1 + i, price: 1250 }] })));
  const activeOrders = await Order.find({ _id: { $in: activeDocs.map((o) => o._id) } }).populate("shop", "name address area location");
  const routeResult = calculateRoute(warehouseA, activeOrders);
  const activePlan = await Plan.create({ name: "Demo Morning Pooled Route", warehouse: warehouseA._id, createdBy: wholesaler._id, deliverySlotStart: activeSlotStart, deliverySlotEnd: activeSlotEnd, route: routeResult.route, orders: activeOrders.map((o) => o._id), rider: riders[0].rider._id, pooled: routeResult.metrics.pooled, solo: routeResult.metrics.solo, savings: routeResult.metrics.savings, meta: { ...routeResult.metrics, algorithm: "demo-seed-route" }, status: "planned" });
  await Order.updateMany({ _id: { $in: activeDocs.map((o) => o._id) } }, { $set: { status: "planned", plan: activePlan._id, rider: riders[0].rider._id } });

  // A second route with one order already picked, useful for rider workflow/status screens.
  const pickedSlotStart = new Date(Date.now() - 30 * 60000);
  const pickedSlotEnd = new Date(Date.now() + 150 * 60000);
  const pickedDoc = await Order.create(orderDoc({ shop: shops[6], warehouse: warehouseB, wholesaler, status: "picked", slotStart: pickedSlotStart, slotEnd: pickedSlotEnd, items: [{ name: "Cooking Oil 5L", quantity: 3, price: 700 }], rider: riders[1].rider._id }));
  const pickedPopulated = await Order.findById(pickedDoc._id).populate("shop", "name address area location");
  const pickedRoute = calculateRoute(warehouseB, [pickedPopulated]);
  const pickedPlan = await Plan.create({ name: "Demo Rider In-Progress Delivery", warehouse: warehouseB._id, createdBy: wholesaler._id, deliverySlotStart: pickedSlotStart, deliverySlotEnd: pickedSlotEnd, route: pickedRoute.route, orders: [pickedDoc._id], rider: riders[1].rider._id, pooled: pickedRoute.metrics.pooled, solo: pickedRoute.metrics.solo, savings: pickedRoute.metrics.savings, meta: { ...pickedRoute.metrics, algorithm: "demo-seed-route" }, status: "planned" });
  await Order.updateOne({ _id: pickedDoc._id }, { $set: { plan: pickedPlan._id } });

  // Seven-day shop + area forecasts for dashboard charts; generated by demo seed, not real ML predictions.
  const forecastDocs = [];
  const slots = ["morning", "afternoon", "evening"];
  for (let d = 0; d < 7; d += 1) {
    const date = new Date(today.getTime() + d * 86400000);
    for (let si = 0; si < shops.length; si += 1) {
      for (let ti = 0; ti < slots.length; ti += 1) {
        const predictedOrders = 1 + ((si + ti + d) % 5);
        forecastDocs.push({ forecastDate: date, wholesaler: wholesaler._id, scope: "shop", shop: shops[si].shop._id, area: shops[si].area, timeSlot: slots[ti], slotStart: new Date(date.getTime() + [9, 13, 18][ti] * 3600000), slotEnd: new Date(date.getTime() + ([9, 13, 18][ti] + 2) * 3600000), predictedOrders, actualOrders: d === 0 ? Math.max(0, predictedOrders - 1) : null, confidence: 0.78 + (si % 3) * 0.05, modelSource: "demo-seed", meta: { demo: true } });
      }
    }
    for (const area of [...new Set(shops.map((s) => s.area))]) {
      for (let ti = 0; ti < slots.length; ti += 1) {
        const shopsInArea = shops.filter((s) => s.area === area).length;
        forecastDocs.push({ forecastDate: date, wholesaler: wholesaler._id, scope: "area", shop: null, area, timeSlot: slots[ti], slotStart: new Date(date.getTime() + [9, 13, 18][ti] * 3600000), slotEnd: new Date(date.getTime() + ([9, 13, 18][ti] + 2) * 3600000), predictedOrders: shopsInArea * (2 + ((d + ti) % 3)), actualOrders: d === 0 ? shopsInArea : null, confidence: 0.82, modelSource: "demo-seed", meta: { demo: true } });
      }
    }
  }
  await Forecast.insertMany(forecastDocs);

  console.log("\nKiranaPool demo seed complete (synthetic Jaipur demo data).\n");
  console.log(`Wholesaler: demo.wholesaler@kiranapool.test / ${demoPassword}`);
  console.log(`Shopkeepers (${shops.length}):`);
  shops.forEach((s) => console.log(`  ${s.email} / ${demoPassword} — ${s.name}`));
  console.log(`Riders (${riders.length}):`);
  riders.forEach((r) => console.log(`  ${r.email} / ${demoPassword} — ${r.name}`));
  console.log(`Warehouses: 2 | Shops: ${shops.length} | Riders: ${riders.length}`);
  console.log(`Orders: ${historicalOrders.length} historical delivered + ${pendingDocs.length} pending + ${activeDocs.length} planned + 1 picked`);
  console.log(`Forecast rows: ${forecastDocs.length} (7 days; shop and area scopes; demo-seed source)`);
  console.log("Run only against your DEMO database; this script deletes/recreates demoSeed orders and demo wholesaler plans/forecasts.");
}

main().catch((error) => { console.error("Demo seed failed:", error); process.exitCode = 1; }).finally(async () => { await mongoose.disconnect(); });
