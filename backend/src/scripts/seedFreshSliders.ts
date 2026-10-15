import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

import { connectDB, disconnectDB } from '../config/database';
import { Slider } from '../models/Slider.model';

const ARTIFACT_DIR = 'C:\\Users\\prade\\.gemini\\antigravity-ide\\brain\\381b5559-71db-4d44-afa4-5e0dbeb3c768';
const SLIDER_UPLOAD_DIR = path.resolve(__dirname, '../../uploads/sliders');

// Ensure upload directory exists
if (!fs.existsSync(SLIDER_UPLOAD_DIR)) {
  fs.mkdirSync(SLIDER_UPLOAD_DIR, { recursive: true });
}

// Generated Panchveda brand banners
const generatedFiles = [
  {
    src: path.join(ARTIFACT_DIR, 'ayurvedic_wellness_banner_1792058280581.jpg'),
    dest: path.join(SLIDER_UPLOAD_DIR, 'panchveda_ayurvedic_banner.jpg'),
    url: '/uploads/sliders/panchveda_ayurvedic_banner.jpg',
  },
  {
    src: path.join(ARTIFACT_DIR, 'welcome_reward_banner_1792058337802.jpg'),
    dest: path.join(SLIDER_UPLOAD_DIR, 'panchveda_turnover_bonus.jpg'),
    url: '/uploads/sliders/panchveda_turnover_bonus.jpg',
  },
  {
    src: path.join(ARTIFACT_DIR, 'binary_income_banner_1792058380052.jpg'),
    dest: path.join(SLIDER_UPLOAD_DIR, 'panchveda_binary_income.jpg'),
    url: '/uploads/sliders/panchveda_binary_income.jpg',
  },
];

// Copy local files
for (const item of generatedFiles) {
  if (fs.existsSync(item.src)) {
    fs.copyFileSync(item.src, item.dest);
    console.log(`[Seed] Copied generated banner to: ${item.dest}`);
  } else {
    console.warn(`[Seed] Warning: source banner not found at: ${item.src}`);
  }
}

const desktopSliders = [
  {
    title: 'Panchveda Wellness - Discover the Essence of Ayurveda',
    link: '/products',
    image: '/uploads/sliders/panchveda_ayurvedic_banner.jpg',
    imageUrl: '/uploads/sliders/panchveda_ayurvedic_banner.jpg',
    type: 'parent' as const,
    order: 1,
    status: 'active' as const,
  },
  {
    title: '4% Company Turnover Welcome Bonus Pool - Celebrate Success',
    link: '/welcome-bonus',
    image: '/uploads/sliders/panchveda_turnover_bonus.jpg',
    imageUrl: '/uploads/sliders/panchveda_turnover_bonus.jpg',
    type: 'parent' as const,
    order: 2,
    status: 'active' as const,
  },
  {
    title: 'Maximize Your Earnings! Binary Tree Income & 20% Matching Bonus',
    link: '/genealogy',
    image: '/uploads/sliders/panchveda_binary_income.jpg',
    imageUrl: '/uploads/sliders/panchveda_binary_income.jpg',
    type: 'parent' as const,
    order: 3,
    status: 'active' as const,
  },
  {
    title: 'Pure Herbal Extracts & Organic Essential Wellness',
    link: '/products',
    image: 'https://images.unsplash.com/photo-1617897903246-719242758050?auto=format&fit=crop&w=1600&q=80',
    imageUrl: 'https://images.unsplash.com/photo-1617897903246-719242758050?auto=format&fit=crop&w=1600&q=80',
    type: 'parent' as const,
    order: 4,
    status: 'active' as const,
  },
  {
    title: 'Leadership Excellence & Nationwide Distributor Network',
    link: '/dashboard',
    image: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1600&q=80',
    imageUrl: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1600&q=80',
    type: 'parent' as const,
    order: 5,
    status: 'active' as const,
  },
];

const mobileSliders = [
  {
    title: 'Panchveda Ayurvedic Wellness - Mobile Edition',
    link: '/products',
    image: '/uploads/sliders/panchveda_ayurvedic_banner.jpg',
    imageUrl: '/uploads/sliders/panchveda_ayurvedic_banner.jpg',
    type: 'child' as const,
    order: 1,
    status: 'active' as const,
  },
  {
    title: 'Turnover Bonus Pool - Track Daily Earnings',
    link: '/welcome-bonus',
    image: '/uploads/sliders/panchveda_turnover_bonus.jpg',
    imageUrl: '/uploads/sliders/panchveda_turnover_bonus.jpg',
    type: 'child' as const,
    order: 2,
    status: 'active' as const,
  },
  {
    title: 'Binary Income Tree & 20% Matching Bonuses',
    link: '/genealogy',
    image: '/uploads/sliders/panchveda_binary_income.jpg',
    imageUrl: '/uploads/sliders/panchveda_binary_income.jpg',
    type: 'child' as const,
    order: 3,
    status: 'active' as const,
  },
  {
    title: 'Vitality & Daily Wellness Supplements',
    link: '/products',
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80',
    imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80',
    type: 'child' as const,
    order: 4,
    status: 'active' as const,
  },
  {
    title: 'Instant Mobile Payouts & Fast Withdrawals',
    link: '/withdrawals',
    image: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=800&q=80',
    imageUrl: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=800&q=80',
    type: 'child' as const,
    order: 5,
    status: 'active' as const,
  },
];

async function seedFresh() {
  try {
    await connectDB();
    console.log('[SeedFresh] Deleting all old sliders...');

    // Delete existing sliders
    const delResult = await Slider.deleteMany({});
    console.log(`[SeedFresh] Deleted ${delResult.deletedCount} old sliders.`);

    // Insert 5 new Desktop sliders
    const createdDesktop = await Slider.insertMany(desktopSliders);
    console.log(`[SeedFresh] Created ${createdDesktop.length} new Desktop ('parent') sliders.`);

    // Insert 5 new Mobile sliders
    const createdMobile = await Slider.insertMany(mobileSliders);
    console.log(`[SeedFresh] Created ${createdMobile.length} new Mobile ('child') sliders.`);

    console.log('[SeedFresh] Successfully replaced all sliders with brand-new imagery!');
    await disconnectDB();
    process.exit(0);
  } catch (err) {
    console.error('[SeedFresh] Error seeding sliders:', err);
    process.exit(1);
  }
}

seedFresh();
