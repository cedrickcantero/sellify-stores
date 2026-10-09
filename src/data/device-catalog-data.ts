import type { DeviceModel } from "./device-catalog";

// The global device catalog: popular Apple, Samsung and Google phones with
// their storage options. Ids are stable so repair and buyback prices can
// reference them across reseeds.
export const DEVICE_CATALOG: DeviceModel[] = [
  // Apple
  { id: "apple-iphone-11", brand: "Apple", name: "iPhone 11", storageOptions: ["64GB", "128GB", "256GB"] },
  { id: "apple-iphone-12", brand: "Apple", name: "iPhone 12", storageOptions: ["64GB", "128GB", "256GB"] },
  { id: "apple-iphone-12-pro", brand: "Apple", name: "iPhone 12 Pro", storageOptions: ["128GB", "256GB", "512GB"] },
  { id: "apple-iphone-13", brand: "Apple", name: "iPhone 13", storageOptions: ["128GB", "256GB", "512GB"] },
  { id: "apple-iphone-13-pro", brand: "Apple", name: "iPhone 13 Pro", storageOptions: ["128GB", "256GB", "512GB", "1TB"] },
  { id: "apple-iphone-14", brand: "Apple", name: "iPhone 14", storageOptions: ["128GB", "256GB", "512GB"] },
  { id: "apple-iphone-14-pro", brand: "Apple", name: "iPhone 14 Pro", storageOptions: ["128GB", "256GB", "512GB", "1TB"] },
  { id: "apple-iphone-15", brand: "Apple", name: "iPhone 15", storageOptions: ["128GB", "256GB", "512GB"] },
  { id: "apple-iphone-15-pro", brand: "Apple", name: "iPhone 15 Pro", storageOptions: ["128GB", "256GB", "512GB", "1TB"] },
  { id: "apple-iphone-15-pro-max", brand: "Apple", name: "iPhone 15 Pro Max", storageOptions: ["256GB", "512GB", "1TB"] },
  { id: "apple-iphone-16", brand: "Apple", name: "iPhone 16", storageOptions: ["128GB", "256GB", "512GB"] },
  { id: "apple-iphone-16-pro", brand: "Apple", name: "iPhone 16 Pro", storageOptions: ["128GB", "256GB", "512GB", "1TB"] },
  { id: "apple-iphone-16-pro-max", brand: "Apple", name: "iPhone 16 Pro Max", storageOptions: ["256GB", "512GB", "1TB"] },
  { id: "apple-iphone-se-2022", brand: "Apple", name: "iPhone SE (2022)", storageOptions: ["64GB", "128GB", "256GB"] },
  // Samsung
  { id: "samsung-galaxy-s21", brand: "Samsung", name: "Galaxy S21", storageOptions: ["128GB", "256GB"] },
  { id: "samsung-galaxy-s22", brand: "Samsung", name: "Galaxy S22", storageOptions: ["128GB", "256GB"] },
  { id: "samsung-galaxy-s23", brand: "Samsung", name: "Galaxy S23", storageOptions: ["128GB", "256GB", "512GB"] },
  { id: "samsung-galaxy-s23-ultra", brand: "Samsung", name: "Galaxy S23 Ultra", storageOptions: ["256GB", "512GB", "1TB"] },
  { id: "samsung-galaxy-s24", brand: "Samsung", name: "Galaxy S24", storageOptions: ["128GB", "256GB", "512GB"] },
  { id: "samsung-galaxy-s24-ultra", brand: "Samsung", name: "Galaxy S24 Ultra", storageOptions: ["256GB", "512GB", "1TB"] },
  { id: "samsung-galaxy-a54", brand: "Samsung", name: "Galaxy A54", storageOptions: ["128GB", "256GB"] },
  { id: "samsung-galaxy-a55", brand: "Samsung", name: "Galaxy A55", storageOptions: ["128GB", "256GB"] },
  { id: "samsung-galaxy-z-flip5", brand: "Samsung", name: "Galaxy Z Flip5", storageOptions: ["256GB", "512GB"] },
  { id: "samsung-galaxy-z-fold5", brand: "Samsung", name: "Galaxy Z Fold5", storageOptions: ["256GB", "512GB", "1TB"] },
  // Google
  { id: "google-pixel-6", brand: "Google", name: "Pixel 6", storageOptions: ["128GB", "256GB"] },
  { id: "google-pixel-6a", brand: "Google", name: "Pixel 6a", storageOptions: ["128GB"] },
  { id: "google-pixel-7", brand: "Google", name: "Pixel 7", storageOptions: ["128GB", "256GB"] },
  { id: "google-pixel-7-pro", brand: "Google", name: "Pixel 7 Pro", storageOptions: ["128GB", "256GB", "512GB"] },
  { id: "google-pixel-8", brand: "Google", name: "Pixel 8", storageOptions: ["128GB", "256GB"] },
  { id: "google-pixel-8-pro", brand: "Google", name: "Pixel 8 Pro", storageOptions: ["128GB", "256GB", "512GB", "1TB"] },
  { id: "google-pixel-8a", brand: "Google", name: "Pixel 8a", storageOptions: ["128GB", "256GB"] },
  { id: "google-pixel-9", brand: "Google", name: "Pixel 9", storageOptions: ["128GB", "256GB"] },
  { id: "google-pixel-9-pro", brand: "Google", name: "Pixel 9 Pro", storageOptions: ["128GB", "256GB", "512GB", "1TB"] },
];
