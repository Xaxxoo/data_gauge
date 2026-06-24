# DataMileage 📡

> Your data. Your money. Your proof.

A mobile app for Nigerians and Africans to track real data usage, measure
connection speeds, and catch carrier overcharging — with Naira cost breakdowns.

## The Problem

MTN, Airtel, Glo, and 9mobile routinely deplete data balances faster than
actual usage justifies. DataMileage gives users the tools to track, measure,
and prove it.

## Features

| Feature | Description |
|---|---|
| **Dashboard** | Today's usage, monthly cost, bundle progress, 7-day chart |
| **Speed Test** | Real download + upload speed via Cloudflare endpoints |
| **Bundle Manager** | Add your bought bundles, track remaining MB in real time |
| **Data Audit** | Log what you used vs what carrier deducted — see discrepancy in ₦ |
| **Carrier Comparison** | MTN / Airtel / Glo / 9mobile ₦/MB rate tables |
| **Usage Reference** | How many MB each common activity costs |
| **NCC Report Guide** | Instructions for reporting to Nigerian Communications Commission |

## Nigerian Carrier Rates (built-in)

All four major Nigerian carriers pre-loaded with current bundle pricing:
- **MTN Nigeria** (yellow)
- **Airtel Nigeria** (red)
- **Glo** (green)
- **9mobile** (dark green)

Rate example: 1GB for ₦300 = ₦0.293/MB = ₦0.000286/KB

## Tech Stack

- React Native + Expo SDK 52
- Expo Router (file-based navigation)
- AsyncStorage (local persistence — no server needed)
- `@react-native-community/netinfo` (connection type detection)
- `react-native-svg` (data rings, speed gauges)
- Speed test via Cloudflare speed.cloudflare.com endpoints

## Getting Started

```bash
# Install dependencies
npm install

# Start Expo dev server
npx expo start

# Run on Android (recommended — Nigeria is ~90% Android)
npx expo start --android

# Build APK for distribution
npx eas build --platform android --profile preview
```

## Structure

```
app/
├── index.tsx          ← Dashboard
├── speed-test.tsx     ← Speed test with gauges
├── bundles.tsx        ← Bundle manager
├── audit.tsx          ← Carrier audit / "catch MTN"
└── settings.tsx       ← Carrier + plan settings

src/
├── lib/
│   ├── carriers.ts    ← Nigerian carrier rate tables
│   ├── dataCalc.ts    ← Byte/MB/₦ conversion helpers
│   ├── speedTest.ts   ← Download/upload speed measurement
│   └── storage.ts     ← AsyncStorage CRUD
├── hooks/
│   ├── useNetworkInfo.ts
│   ├── useSpeedTest.ts
│   └── useDataUsage.ts
└── components/
    ├── DataRing.tsx   ← SVG donut ring for bundle usage
    ├── SpeedGauge.tsx ← Semi-circle speed gauge
    └── UsageBar.tsx   ← Linear progress bar with ₦ cost
```

## How the Audit Feature Works

1. User notes data balance **before** an activity on carrier's USSD/app
2. User performs the activity (watch YouTube, browse, WhatsApp, etc.)
3. User notes data balance **after** on carrier
4. User logs both in the Audit tab with the expected MB (from reference table)
5. App calculates discrepancy and shows ₦ value of overcharge

If discrepancy > ₦100, app shows NCC (Nigeria Communications Commission) complaint links.

## Reporting Carrier Theft

- **NCC Portal**: ncc.gov.ng
- **Email**: consumeraffairs@ncc.gov.ng
- **SMS**: Send complaint to **622**
- **Twitter/X**: @NCCgovNg

## License

MIT — free to use, share, fork.
