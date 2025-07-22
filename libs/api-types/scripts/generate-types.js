#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Generating TypeScript types from OpenAPI schema...');

try {
  // Paths
  const schemaPath = path.join(__dirname, '../schema/openapi.json');
  const outputPath = path.join(__dirname, '../src/lib/generated-types.ts');
  
  // Check if schema exists
  if (!fs.existsSync(schemaPath)) {
    console.error('❌ OpenAPI schema not found at:', schemaPath);
    process.exit(1);
  }

  // Generate types using openapi-typescript
  console.log('📝 Running openapi-typescript...');
  const command = `npx openapi-typescript "${schemaPath}" --output "${outputPath}"`;
  
  execSync(command, { 
    stdio: 'inherit',
    cwd: path.join(__dirname, '../../../') // Root directory for npx
  });

  console.log('✅ TypeScript types generated successfully!');
  console.log('📁 Output:', outputPath);
  console.log('💡 Custom type utilities are available in api-types.ts');

} catch (error) {
  console.error('❌ Type generation failed:', error.message);
  process.exit(1);
} 