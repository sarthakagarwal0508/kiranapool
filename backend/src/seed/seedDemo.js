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

const demoPassword = "KiranaDemo@123";
const shopsData = [
  { key: "mansarovar", name: "Demo Mansarovar Kirana", ownerName: "Amit Demo", email: "demo.shopkeeper1@kiranapool.test", phone: "9000000001", area: "Mansarovar", address: "Mansarovar, Jaipur", location: { lat: 26.8540, lng: 75.7640 } },
  { key: "malviya", name: "Demo Malviya Kirana", ownerName: "Riya Demo", email: "demo.shopkeeper2@kiranapool.test", phone: "9000000002", area: "Malviya Nagar", address: "Malviya Nagar, Jaipur", location: { lat: 26.8545, lng: 75.8050 } },
  { key: "jagatpura", name: "Demo Jagatpura Kirana", ownerName: "Rahul Demo", email: "demo.shopkeeper3@kiranapool.test", phone: "9000000003", area: "Jagatpura", address: "Jagatpura, Jaipur", location: { lat: 26.8390, lng: 75.8560 } },
  { key: "sanganer", name: "Demo Sanganer Kirana", ownerName: "Neha Demo", email: "demo.shopkeeper4@kiranapool.test", phone: "9000000004", area: "Sanganer", address: "Sanganer, Jaipur", location: { lat: 26.8190, lng: 75.7760 } },
];

async function upsertUser({ name, email, role, passwordHash }) {
  return User.findOneAndUpdate(
    { email },
    { $set: { name, role, passwordHash } },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
  );
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
    { $set: { owner: wholesaler._id, name: "Demo Jaipur Central Warehouse", supplierName: wholesaler.name, address: "Sitapura Industrial Area, Jaipur", location: { lat: 26.785, lng: 75.850 }, serviceAreas: ["Mansarovar", "Malviya Nagar", "Jagatpura", "Sanganer"], isActive: true } },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
  );
  const warehouseB = await Warehouse.findOneAndUpdate(
    { owner: wholesaler._id, name: "Demo Jaipur North Warehouse" },
    { $set: { owner: wholesaler._id, name: "Demo Jaipur North Warehouse", supplierName: wholesaler.name, address: "Vidhyadhar Nagar, Jaipur", location: { lat: 26.961, lng: 75.779 }, serviceAreas: ["Mansarovar", "Malviya Nagar", "Jagatpura"], isActive: true } },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
  );

  const riderUser = await upsertUser({ name: "Demo Rider", email: "demo.rider@kiranapool.test", role: "rider", passwordHash });
  await Rider.findOneAndUpdate(
    { user: riderUser._id },
    { $set: { user: riderUser._id, name: riderUser.name, phone: "9000000099", vehicleType: "bike", location: { lat: 26.785, lng: 75.850 }, isAvailable: true } },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
  );

  await Plan.deleteMany({ createdBy: wholesaler._id, warehouse: { $in: [warehouseA._id, warehouseB._id] } });
  await Forecast.deleteMany({ wholesaler: wholesaler._id });
  await Order.deleteMany({ demoSeed: true, createdBy: wholesaler._id });
  const slotHours = [9, 13, 18];
  const historyDocs = [];
  const today = startOfIstDay(new Date());
  for (let day = -28; day < 0; day += 1) {
    const dayStart = new Date(today.getTime() + day * 86400000);
    for (let shopIndex = 0; shopIndex < shops.length; shopIndex += 1) {
      for (let slotIndex = 0; slotIndex < slotHours.length; slotIndex += 1) {
        // Deterministic variation provides repeatable, non-uniform training history.
        if ((Math.abs(day) + shopIndex * 2 + slotIndex) % (shopIndex === 2 ? 4 : 3) === 0) continue;
        const hour = slotHours[slotIndex];
        const slotStart = new Date(dayStart.getTime() + hour * 3600000);
        const shop = shops[shopIndex];
        const createdAt = new Date(slotStart.getTime() - 12 * 3600000);
        historyDocs.push({
          shop: shop.shop._id,
          warehouse: shopIndex === 2 ? warehouseB._id : warehouseA._id,
          createdBy: wholesaler._id,
          orderSource: "wholesaler_manual",
          demoSeed: true,
          customerName: shop.shop.name,
          customerPhone: shop.phone,
          deliveryAddress: shop.address,
          location: shop.location,
          items: [{ name: "Rice 25kg", quantity: 1 + ((Math.abs(day) + shopIndex) % 4), price: 1250 }],
          totalAmount: 1250 * (1 + ((Math.abs(day) + shopIndex) % 4)),
          status: "delivered",
          deliveryWindowMin: 120,
          deliverySlotStart: slotStart,
          deliverySlotEnd: new Date(slotStart.getTime() + 2 * 3600000),
          createdAt,
          updatedAt: createdAt,
        });
      }
    }
  }

  const pendingDocs = [];
  // Five near-by orders in one shared slot, designed to produce a meaningful pooled route.
  for (let i = 0; i < shops.length; i += 1) {
    const shop = shops[i];
    const slotStart = new Date(today.getTime() + 1 * 86400000 + 10 * 3600000);
    pendingDocs.push({
      shop: shop.shop._id,
      warehouse: warehouseA._id,
      createdBy: wholesaler._id,
      orderSource: "wholesaler_manual",
      demoSeed: true,
      customerName: shop.shop.name,
      customerPhone: shop.phone,
      deliveryAddress: shop.address,
      location: shop.location,
      items: [{ name: "Wheat Flour 10kg", quantity: 2 + i, price: 400 }],
      totalAmount: (2 + i) * 400,
      status: "pending",
      deliveryWindowMin: 120,
      deliverySlotStart: slotStart,
      deliverySlotEnd: new Date(slotStart.getTime() + 2 * 3600000),
    });
  }
  for (let i = 0; i < 2; i += 1) {
    const shop = shops[i];
    const slotStart = new Date(today.getTime() + 2 * 86400000 + 14 * 3600000);
    pendingDocs.push({
      shop: shop.shop._id,
      warehouse: warehouseB._id,
      createdBy: wholesaler._id,
      orderSource: "wholesaler_manual",
      demoSeed: true,
      customerName: shop.shop.name,
      customerPhone: shop.phone,
      deliveryAddress: shop.address,
      location: shop.location,
      items: [{ name: "Cooking Oil 5L", quantity: 2, price: 700 }],
      totalAmount: 1400,
      status: "pending",
      deliveryWindowMin: 180,
      deliverySlotStart: slotStart,
      deliverySlotEnd: new Date(slotStart.getTime() + 3 * 3600000),
    });
  }
  await Order.insertMany([...historyDocs, ...pendingDocs]);
  console.log("Demo data seeded successfully.");
  console.log("Demo login password (all demo accounts):", demoPassword);
  console.log("Wholesaler: demo.wholesaler@kiranapool.test");
  console.log("Shopkeepers:", shopsData.map((s) => s.email).join(", "));
  console.log("Rider: demo.rider@kiranapool.test");
  console.log(`Created ${historyDocs.length} historical orders and ${pendingDocs.length} pending timed orders.`);
}

main().catch((error) => { console.error("Demo seed failed:", error); process.exitCode = 1; }).finally(async () => { await mongoose.disconnect(); });
