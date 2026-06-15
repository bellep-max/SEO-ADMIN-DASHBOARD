// Seed demo data via the running API (port 5000). Run: node scripts/seed-demo.mjs
const API = "http://localhost:5000/api";

let token;
async function api(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}: ${typeof json === "string" ? json.slice(0, 200) : JSON.stringify(json)}`);
  }
  return json;
}

const login = await api("POST", "/auth/login", { email: "admin@example.com", password: "admin123" });
token = login.token;
console.log("logged in");

const plan = await api("POST", "/plans", { name: "Pro Local", price: 499, keywordLimit: 100, backlinkCheckLimit: 50, auditLimit: 10 });
console.log("plan", plan.id);

const client = await api("POST", "/clients", {
  name: "Austin Roofing Co", email: "owner@austinroofing.com", company: "Austin Roofing Co",
  phone: "512-555-0142", websiteUrl: "https://austinroofing.com", status: "active",
  accountType: "local", assignedPlanId: plan.id,
});
console.log("client", client.id);

const biz = await api("POST", "/businesses", {
  clientId: client.id, businessName: "Austin Roofing Co", address: "600 Congress Ave, Austin, TX 78701",
  phone: "512-555-0142", website: "https://austinroofing.com", category: "Roofing Contractor", zipCode: "78701",
});
console.log("business", biz.id);

const camp = await api("POST", "/campaigns", {
  clientId: client.id, name: "Austin Roofing - Q3", targetDomain: "austinroofing.com",
  targetLocation: "Austin, TX", status: "active", businessId: biz.id,
});
console.log("campaign", camp.id);

const keywords = [
  { keywordText: "roofing austin tx", currentRank: 3, previousRank: 5, searchVolume: 1200, isPrimary: true },
  { keywordText: "roof repair austin", currentRank: 7, previousRank: 4, searchVolume: 880 },
  { keywordText: "metal roof installation", currentRank: 12, previousRank: 12, searchVolume: 320 },
  { keywordText: "emergency roof repair", currentRank: 2, previousRank: 9, searchVolume: 540 },
  { keywordText: "roof replacement cost", currentRank: 18, previousRank: 15, searchVolume: 210 },
];
for (const k of keywords) {
  await api("POST", "/keywords", { campaignId: camp.id, isActive: true, searchLocation: "Austin, TX", ...k });
  console.log("  keyword", k.keywordText);
}

const grid = await api("POST", "/geo-grids", {
  clientId: client.id, campaignId: camp.id, businessId: biz.id, keyword: "roofing austin tx",
  centerAddress: "Austin, TX", centerLat: 30.2672, centerLng: -97.7431, radiusMiles: 5, gridSize: 7,
});
console.log("geo-grid", grid.id);
await api("POST", `/geo-grids/${grid.id}/generate`);
console.log("  heatmap generated");

await api("POST", "/clients", {
  name: "Lone Star Dental", email: "hello@lonestardental.com", company: "Lone Star Dental",
  phone: "512-555-0199", websiteUrl: "https://lonestardental.com", status: "active", accountType: "local",
});
console.log("client 2: Lone Star Dental");

console.log("DONE");
