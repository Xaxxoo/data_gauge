const fs = require('fs');
const path = require('path');

const filesToFix = [
  'app/audit.tsx',
  'app/bundles.tsx',
  'app/buy-data.tsx',
  'app/index.tsx',
  'app/settings.tsx',
  'app/ussd-check.tsx',
];

for (const relPath of filesToFix) {
  const file = path.join('/Users/nn/data manager', relPath);
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');

  // Add import { CARRIER_COLORS } from '../src/components/ui/colors'; if missing but used
  if (content.includes('CARRIER_COLORS') && !content.includes('CARRIER_COLORS} from')) {
    const importStmt = `import { CARRIER_COLORS } from '../src/components/ui/colors';\n`;
    content = importStmt + content;
  }

  // Also fix relative path if needed in app/index.tsx app/settings.tsx etc.
  fs.writeFileSync(file, content, 'utf8');
  console.log(`Fixed CARRIER_COLORS in ${file}`);
}

// Fix UsageBar.tsx
const usageBarFile = path.join('/Users/nn/data manager/src/components/UsageBar.tsx');
if (fs.existsSync(usageBarFile)) {
  let uContent = fs.readFileSync(usageBarFile, 'utf8');
  uContent = uContent.replace(/color = colors\.accent/g, 'color');
  uContent = uContent.replace(/const barColor = pct >= 90 \? colors\.danger : pct >= 70 \? colors\.warning : color;/, 'const barColor = pct >= 90 ? colors.danger : pct >= 70 ? colors.warning : (color || colors.accent);');
  fs.writeFileSync(usageBarFile, uContent, 'utf8');
  console.log('Fixed UsageBar.tsx');
}
