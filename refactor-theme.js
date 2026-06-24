const fs = require('fs');
const path = require('path');

const filesToRefactor = [
  'app/index.tsx',
  'app/earn.tsx',
  'app/history.tsx',
  'app/settings.tsx',
  'app/bundles.tsx',
  'app/audit.tsx',
  'app/buy-data.tsx',
  'app/ussd-check.tsx',
  'app/speed-test.tsx',
  'src/components/UsageBar.tsx',
];

for (const relPath of filesToRefactor) {
  const file = path.join('/Users/nn/data manager', relPath);
  if (!fs.existsSync(file)) {
    console.log(`Skipping ${file}, does not exist.`);
    continue;
  }
  let content = fs.readFileSync(file, 'utf8');

  // 1. Replace import { C } ...
  // We need to import useTheme and ThemeColors
  if (content.includes("import { C")) {
    const depth = relPath.startsWith('app/') ? '../src' : '..';
    content = content.replace(/import \{ C.*\} from '.*colors';/, `import { useTheme } from '${depth}/lib/theme';\nimport { ThemeColors } from '${depth}/components/ui/colors';`);
  }

  // 2. Change StyleSheet.create to getStyles
  if (content.includes('const styles = StyleSheet.create({')) {
    content = content.replace('const styles = StyleSheet.create({', 'const getStyles = (colors: ThemeColors) => StyleSheet.create({');
    
    // Replace C. with colors. in the whole file
    content = content.replace(/C\./g, 'colors.');
  }

  // 3. Inject useTheme and useMemo inside the main exported component
  // Find "export default function " or "export function "
  const compMatch = content.match(/export (?:default )?function ([A-Za-z0-9_]+)\s*\([^)]*\)\s*\{/);
  if (compMatch) {
    const compStart = compMatch[0];
    const inject = `\n  const { colors, isDark, setMode, mode } = useTheme();\n  const styles = React.useMemo(() => getStyles(colors), [colors]);\n`;
    content = content.replace(compStart, compStart + inject);
    
    // Make sure React is imported if useMemo is used, but we can just use React.useMemo
    if (!content.includes("import React")) {
      content = `import React from 'react';\n` + content;
    }
  }

  fs.writeFileSync(file, content, 'utf8');
  console.log(`Refactored ${file}`);
}
