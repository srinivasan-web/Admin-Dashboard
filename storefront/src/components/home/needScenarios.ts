import type { Product } from "../../api/catalog";

type NeedScenario = {
  id: string;
  label: string;
  shortLabel: string;
  eyebrow: string;
  title: string;
  problem: string;
  approach: string;
  checks: readonly string[];
  specificationTerms: readonly string[];
  destination: "catalog" | "price" | "specifications" | "support";
  cta: string;
  visualNote: string;
};

// Editorial buying guidance, not eligibility rules or personalized matching.
// Attribute names and values always come from the public ProductResource.
export const needScenarios = [
  {
    id: "space",
    label: "Make it fit my space",
    shortLabel: "My space",
    eyebrow: "YOUR ROOM. YOUR ROUTINE.",
    title: "A little planning. More room to move.",
    problem: "Your workout needs to fit around the rest of your home.",
    approach:
      "Measure your available space, then check the product’s dimensions and storage instructions before choosing.",
    checks: [
      "Equipment footprint",
      "Room to get on and off",
      "Folded size, if specified",
    ],
    specificationTerms: ["dimension", "length", "width", "fold", "size"],
    destination: "specifications",
    cta: "Check product specifications",
    visualNote: "Measure the space before you choose.",
  },
  {
    id: "routine",
    label: "Find my kind of movement",
    shortLabel: "My routine",
    eyebrow: "START WITH HOW YOU MOVE.",
    title: "Build around the routine you want.",
    problem:
      "You know you want to move more. Choosing the equipment is the next step.",
    approach:
      "Explore the equipment categories and read each product’s intended use, speed or resistance specifications.",
    checks: [
      "Intended activity",
      "Speed or resistance range",
      "Controls and adjustments",
    ],
    specificationTerms: ["speed", "resistance", "incline"],
    destination: "catalog",
    cta: "Explore equipment",
    visualNote: "Choose the movement you want to make time for.",
  },
  {
    id: "budget",
    label: "Work with my budget",
    shortLabel: "My budget",
    eyebrow: "CLARITY BEFORE COMMITMENT.",
    title: "Find value in the details.",
    problem:
      "A price is useful. Knowing what you get for it matters just as much.",
    approach:
      "Start with the catalog’s lowest current prices, then check the features and specifications that matter to you.",
    checks: [
      "Current selling price",
      "Features you will use",
      "Any delivery or installation charges",
    ],
    specificationTerms: [],
    destination: "price",
    cta: "Explore prices, low to high",
    visualNote: "See current prices. Take your time choosing.",
  },
  {
    id: "household",
    label: "Choose for our household",
    shortLabel: "Our household",
    eyebrow: "DIFFERENT PEOPLE. ONE HOME.",
    title: "Check the details for everyone using it.",
    problem:
      "The people sharing your equipment may have different requirements.",
    approach:
      "Check the manufacturer’s user limits, adjustments and instructions against each person’s needs.",
    checks: [
      "Maximum user weight",
      "Adjustable settings",
      "Safety and intended use",
    ],
    specificationTerms: ["weight", "capacity", "adjust"],
    destination: "specifications",
    cta: "Check product specifications",
    visualNote: "Consider every person who will use it.",
  },
  {
    id: "practicalities",
    label: "Think about everyday living",
    shortLabel: "Everyday living",
    eyebrow: "FITNESS MEETS REAL LIFE.",
    title: "Think beyond the workout.",
    problem: "Storage, movement and sound can matter in a shared living space.",
    approach:
      "Check documented storage and transport features. Ask support about sound and installation requirements when those details are not listed.",
    checks: [
      "Storage instructions",
      "Equipment weight and moving it",
      "Documented sound information",
    ],
    specificationTerms: ["fold", "storage", "wheel", "noise", "weight"],
    destination: "specifications",
    cta: "Check product specifications",
    visualNote: "Plan for the moments between workouts, too.",
  },
  {
    id: "support",
    label: "Understand what happens next",
    shortLabel: "Help & service",
    eyebrow: "ASK BEFORE YOU DECIDE.",
    title: "Get clear on life after delivery.",
    problem: "You want to understand setup, warranty and how to get help.",
    approach:
      "Read the current warranty terms and ask Durafit about delivery, installation and service for your chosen product and location.",
    checks: [
      "Delivery to your location",
      "Assembly options and charges",
      "Warranty coverage and exclusions",
    ],
    specificationTerms: [],
    destination: "support",
    cta: "Explore Durafit support",
    visualNote: "A few questions now can make choosing easier.",
  },
] as const satisfies readonly NeedScenario[];

export type Need = (typeof needScenarios)[number];
export type NeedId = Need["id"];

export function collectionProducts(...collections: (Product[] | undefined)[]) {
  const products = new Map<string, Product>();
  for (const collection of collections)
    for (const product of collection ?? []) products.set(product.id, product);
  return [...products.values()];
}

export function previewSpecification(product: Product, need: Need) {
  return product.specifications.find((specification) =>
    need.specificationTerms.some((term) =>
      specification.attribute.name.toLowerCase().includes(term),
    ),
  );
}

export function previewProduct(products: Product[], need: Need) {
  // This previews existing merchandising selections; it does not rank suitability.
  if (need.destination === "price") {
    return products.reduce<Product | undefined>((lowest, product) => {
      const price = Number(product.price.sale ?? product.price.mrp);
      const previous = lowest
        ? Number(lowest.price.sale ?? lowest.price.mrp)
        : Infinity;
      return Number.isFinite(price) && price < previous ? product : lowest;
    }, undefined);
  }
  return (
    products.find((product) => previewSpecification(product, need)) ??
    products[0]
  );
}

export function needJourney(need: Need, product?: Product) {
  if (need.destination === "support") return "https://www.durafit91.com/91wiz";
  if (need.destination === "price") return "/products?sort=price_asc";
  if (need.destination === "specifications" && product)
    return `/products/${encodeURIComponent(product.id)}`;
  return "/products";
}
