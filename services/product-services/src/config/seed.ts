import "dotenv/config";
import {
  createCategory,
  findCategoryByName,
  CategoryRow,
} from "../repositories/category.repository";
import { createProduct } from "../repositories/product.repository";
import { countProductsInCategory } from "../repositories/product.repository";
import { toProductResponse } from "../services/product.service";
import {
  connectProducer,
  disconnectProducer,
  publishProductUpserted,
} from "../events/productEvents.publisher";
import { pool } from "./db";

const CATEGORIES = [
  { name: "Skincare", icon: "sparkles", color: "#F5C6D0" },
  { name: "Haircare", icon: "scissors", color: "#C9A66B" },
  { name: "Immunity Boosters", icon: "shield", color: "#8FBF8F" },
  { name: "Digestive Health", icon: "leaf", color: "#A3C9A8" },
  { name: "Personal Care", icon: "droplet", color: "#B8D8D8" },
  { name: "Supplements", icon: "pill", color: "#E8C39E" },
  { name: "Ayurvedic Oils", icon: "flask", color: "#D9A5B3" },
  { name: "Herbal Teas", icon: "cup", color: "#C7B198" },
];

// 5 products per category, generated from a small template rather than hand-typed one by one - keeps this file readable while still giving each product distinct name/price/stock so pagination and search filters actually have something to bite into.
const PRODUCT_TEMPLATES: Record<
  string,
  { name: string; brand: string; price: number }[]
> = {
  Skincare: [
    { name: "Gentle Face Wash", brand: "PureGlow", price: 1112.99 },
    { name: "Vitamin C Serum", brand: "PureGlow", price: 2234.5 },
    { name: "Aloe Vera Gel", brand: "NatureCo", price: 258.99 },
    { name: "Charcoal Face Mask", brand: "PureGlow", price: 2415.0 },
    { name: "Rosewater Toner", brand: "NatureCo", price: 2439.5 },
  ],
  Haircare: [
    { name: "Argan Oil Shampoo", brand: "HairVeda", price: 2411.99 },
    { name: "Onion Hair Oil", brand: "HairVeda", price: 113.5 },
    { name: "Bhringraj Hair Mask", brand: "NatureCo", price: 216.0 },
    { name: "Anti-Dandruff Serum", brand: "HairVeda", price: 514.25 },
    { name: "Hair Growth Tonic", brand: "HairVeda", price: 619.99 },
  ],
  "Immunity Boosters": [
    { name: "Chyawanprash 500g", brand: "AyurLife", price: 2410.0 },
    { name: "Giloy Tablets", brand: "AyurLife", price: 3412.75 },
    { name: "Turmeric Curcumin Caps", brand: "AyurLife", price: 2514.0 },
    { name: "Amla Juice 1L", brand: "NatureCo", price: 259.25 },
    { name: "Tulsi Drops", brand: "AyurLife", price: 2458.5 },
  ],
  "Digestive Health": [
    { name: "Triphala Powder", brand: "AyurLife", price: 2457.99 },
    { name: "Ajwain Digestive Tablets", brand: "AyurLife", price: 2446.5 },
    { name: "Probiotic Capsules", brand: "WellBeing", price: 418.0 },
    { name: "Fennel Tea Bags", brand: "NatureCo", price: 236.99 },
    { name: "Aloe Digestive Juice", brand: "NatureCo", price: 119.0 },
  ],
  "Personal Care": [
    { name: "Neem Handwash", brand: "PureGlow", price: 153.99 },
    { name: "Sandalwood Soap Bar", brand: "NatureCo", price: 454.5 },
    { name: "Herbal Deodorant", brand: "WellBeing", price: 2778.25 },
    { name: "Rose Body Lotion", brand: "PureGlow", price: 2411.0 },
    { name: "Lip Balm - Shea Butter", brand: "PureGlow", price: 2453.99 },
  ],
  Supplements: [
    { name: "Ashwagandha Capsules", brand: "WellBeing", price: 2515.99 },
    { name: "Multivitamin Tablets", brand: "WellBeing", price: 417.5 },
    { name: "Omega-3 Fish Oil", brand: "WellBeing", price: 2321.0 },
    { name: "Biotin Hair & Skin", brand: "WellBeing", price: 2116.25 },
    { name: "Calcium + D3 Tablets", brand: "WellBeing", price: 2413.75 },
  ],
  "Ayurvedic Oils": [
    { name: "Sesame Massage Oil", brand: "AyurLife", price: 1210.5 },
    { name: "Kumkumadi Face Oil", brand: "AyurLife", price: 2322.0 },
    { name: "Coconut Hair Oil", brand: "NatureCo", price: 347.25 },
    { name: "Mahanarayan Pain Oil", brand: "AyurLife", price: 2512.0 },
    { name: "Castor Oil 200ml", brand: "NatureCo", price: 2226.75 },
  ],
  "Herbal Teas": [
    { name: "Green Tea with Tulsi", brand: "NatureCo", price: 236.25 },
    { name: "Chamomile Sleep Tea", brand: "WellBeing", price: 2557.5 },
    { name: "Ginger Lemon Tea", brand: "NatureCo", price: 345.75 },
    { name: "Detox Herbal Tea", brand: "WellBeing", price: 348.0 },
    { name: "Hibiscus Tea", brand: "NatureCo", price: 346.5 },
  ],
};

async function ensureCategory(cat: {
  name: string;
  icon: string;
  color: string;
}): Promise<CategoryRow> {
  const existing = await findCategoryByName(cat.name);
  if (existing) {
    console.log(`- category "${cat.name}" already exists`);
    return existing;
  }
  const created = await createCategory(cat);
  console.log(`✓ created category "${cat.name}"`);
  return created;
}

async function seed() {
  await connectProducer();

  try {
    for (const cat of CATEGORIES) {
      const category = await ensureCategory(cat);

      // Skip re-seeding products for a category that already has some.
      const existingCount = await countProductsInCategory(category.id);

      if (existingCount > 0) {
        console.log(
          `  - skip products for "${cat.name}" (${existingCount} already exist)`,
        );
        continue;
      }

      const templates = PRODUCT_TEMPLATES[cat.name] ?? [];

      for (const [i, t] of templates.entries()) {
        const product = await createProduct({
          name: t.name,
          description: `${t.name} - a ${cat.name.toLowerCase()} essential from ${t.brand}.`,
          richDescription: `Crafted with natural ingredients, ${t.name} supports your daily wellness routine.`,
          image: `https://picsum.photos/seed/${encodeURIComponent(t.name)}/400/400`,
          images: [
            `https://picsum.photos/seed/${encodeURIComponent(t.name)}-1/400/400`,
          ],
          brand: t.brand,
          price: t.price,
          categoryId: category.id,
          countInStock: 20 + i * 7,
          isFeatured: i === 0,
          ingredients: "Natural extracts, purified water, essential oils",
          usageNotes: "Use as directed, twice daily for best results",
          benefits: "Nourishes and supports overall wellness",
          precautions:
            "For external use only. Discontinue if irritation occurs.",
          quantity: "100ml",
        });

        const productResponse = toProductResponse(product);

        await publishProductUpserted(productResponse);

        console.log(`  ✓ seeded + published "${product.name}"`);
      }

      console.log(`  ✓ seeded ${templates.length} products in "${cat.name}"`);
    }
  } finally {
    // Cleanup ONLY after ALL categories/products are processed.
    await disconnectProducer();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
