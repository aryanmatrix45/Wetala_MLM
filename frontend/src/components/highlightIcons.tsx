import React from 'react';
import {
  Apple,
  Award,
  Baby,
  Droplet,
  Flower2,
  Heart,
  HeartPulse,
  Home,
  Pill,
  Recycle,
  Salad,
  ShieldCheck,
  Smile,
  Sparkles,
  Sprout,
  Sun,
  TreeDeciduous,
  Users,
  Wheat,
  type LucideIcon,
} from 'lucide-react';

/* Icons available to Home Highlight cards. Keys must match HIGHLIGHT_ICON_KEYS in the backend model. */

type IconProps = { size?: number };

const svgProps = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
});

// Solid leaf with a curved midrib (as on the Health & Wellness card)
const LeafSolid: React.FC<IconProps> = ({ size = 24 }) => (
  <svg {...svgProps(size)}>
    <path d="M20.5 3.5C11 3.5 4.5 8.6 4.5 15.4c0 1.6.4 3 1.1 4.1C9.4 20 20.5 17.6 20.5 3.5z" fill="currentColor" stroke="none" />
    <path d="M4 21c2.6-4.6 6.4-8.4 11.5-11.5" stroke="var(--hl-icon-contrast, #fff)" strokeWidth={1.5} />
  </svg>
);

// Lotus in outline (as on the Personal Care card)
const Lotus: React.FC<IconProps> = ({ size = 24 }) => (
  <svg {...svgProps(size)}>
    <path d="M12 4.5c-1.9 2.1-2.9 4.4-2.9 6.8 0 2.2 1.1 4.1 2.9 5.5 1.8-1.4 2.9-3.3 2.9-5.5 0-2.4-1-4.7-2.9-6.8z" />
    <path d="M3.5 9.2c.3 3.8 2.8 6.7 8.5 7.6-1.4-3.4-4.4-6.4-8.5-7.6z" />
    <path d="M20.5 9.2c-.3 3.8-2.8 6.7-8.5 7.6 1.4-3.4 4.4-6.4 8.5-7.6z" />
    <path d="M2 14.6c2.1 2.4 5.6 3.7 10 3.7s7.9-1.3 10-3.7" />
  </svg>
);

// Two leaves on a stem (as on the Agriculture card)
const TwinLeaves: React.FC<IconProps> = ({ size = 24 }) => (
  <svg {...svgProps(size)}>
    <path d="M12 21V11.5" />
    <path d="M12 13.5C11.6 8.9 8.4 6.1 3 5.8c0 5.3 3.4 8.4 9 7.7z" fill="currentColor" fillOpacity={0.9} />
    <path d="M12 11.5c.4-4.8 3.8-7.8 9.2-8.2 0 5.6-3.6 8.8-9.2 8.2z" fill="currentColor" fillOpacity={0.9} />
  </svg>
);

// Herb sprig with alternating leaves
const Herb: React.FC<IconProps> = ({ size = 24 }) => (
  <svg {...svgProps(size)}>
    <path d="M12 22V5" />
    <path d="M12 9c-2.6 0-4.6-1.6-5-4 2.6 0 4.6 1.6 5 4z" />
    <path d="M12 13c2.6 0 4.6-1.6 5-4-2.6 0-4.6 1.6-5 4z" />
    <path d="M12 17c-2.6 0-4.6-1.6-5-4 2.6 0 4.6 1.6 5 4z" />
    <path d="M12 5c.8-1.2 1.6-2 2.5-2.5" />
  </svg>
);

// Ayurvedic mortar and pestle
const MortarPestle: React.FC<IconProps> = ({ size = 24 }) => (
  <svg {...svgProps(size)}>
    <path d="M3.5 12h17a8.5 8.5 0 0 1-17 0z" />
    <path d="M9 20.5h6" />
    <path d="M13.5 12l5.5-8.5" />
    <path d="M8 9.5c.6-1.6 1.8-2.5 3-2.5" />
  </svg>
);

const lucide = (Icon: LucideIcon): React.FC<IconProps> =>
  ({ size = 24 }) => <Icon size={size} strokeWidth={1.75} aria-hidden="true" />;

export interface HighlightIconOption {
  key: string;
  label: string;
  Icon: React.FC<IconProps>;
}

export const HIGHLIGHT_ICONS: HighlightIconOption[] = [
  { key: 'leaf', label: 'Leaf', Icon: LeafSolid },
  { key: 'lotus', label: 'Lotus', Icon: Lotus },
  { key: 'twin-leaves', label: 'Twin leaves', Icon: TwinLeaves },
  { key: 'sprout', label: 'Sprout', Icon: lucide(Sprout) },
  { key: 'herb', label: 'Herb', Icon: Herb },
  { key: 'mortar', label: 'Mortar & pestle', Icon: MortarPestle },
  { key: 'flower', label: 'Flower', Icon: lucide(Flower2) },
  { key: 'tree', label: 'Tree', Icon: lucide(TreeDeciduous) },
  { key: 'wheat', label: 'Wheat', Icon: lucide(Wheat) },
  { key: 'droplet', label: 'Water drop', Icon: lucide(Droplet) },
  { key: 'sun', label: 'Sun', Icon: lucide(Sun) },
  { key: 'heart', label: 'Heart', Icon: lucide(Heart) },
  { key: 'heart-pulse', label: 'Health', Icon: lucide(HeartPulse) },
  { key: 'shield', label: 'Protection', Icon: lucide(ShieldCheck) },
  { key: 'sparkles', label: 'Sparkles', Icon: lucide(Sparkles) },
  { key: 'apple', label: 'Apple', Icon: lucide(Apple) },
  { key: 'salad', label: 'Nutrition', Icon: lucide(Salad) },
  { key: 'pill', label: 'Supplement', Icon: lucide(Pill) },
  { key: 'baby', label: 'Baby care', Icon: lucide(Baby) },
  { key: 'family', label: 'Family', Icon: lucide(Users) },
  { key: 'home', label: 'Home care', Icon: lucide(Home) },
  { key: 'recycle', label: 'Eco friendly', Icon: lucide(Recycle) },
  { key: 'award', label: 'Quality', Icon: lucide(Award) },
  { key: 'smile', label: 'Happiness', Icon: lucide(Smile) },
];

const BY_KEY = new Map(HIGHLIGHT_ICONS.map((o) => [o.key, o]));

export const HighlightIcon: React.FC<{ name?: string; size?: number }> = ({ name, size = 24 }) => {
  const { Icon } = BY_KEY.get(name || '') || HIGHLIGHT_ICONS[0];
  return <Icon size={size} />;
};
