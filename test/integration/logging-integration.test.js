/**
 * Simple integration test to verify secure logging implementation
 */

const fs = require('fs');
const path = require('path');

console.log("Running secureLogger integration tests...");

// Get the root directory
const rootDir = process.cwd();

// Helper function to read a file safely
function safeReadFile(filePath) {
  try {
    const fullPath = path.join(rootDir, filePath);
    if (!fs.existsSync(fullPath)) {
      console.log(`File not found: ${fullPath}`);
      return "";
    }
    return fs.readFileSync(fullPath, 'utf8');
  } catch (error) {
    console.log(`Error reading file ${filePath}: ${error.message}`);
    return "";
  }
}

// Files to check for proper implementation
const files = [
  { path: 'apiClient.js', importPattern: 'import secureLogger', logPattern: 'secureLogger.log' },
  { path: 'home.js', importPattern: 'import secureLogger', logPattern: 'secureLogger.log' },
  { path: 'forms/popup.js', importPattern: 'import secureLogger', logPattern: 'secureLogger.log' },
  { path: 'forms/gpt.js', importPattern: 'import secureLogger', logPattern: 'secureLogger.log' },
  { path: 'forms/content.js', importPattern: 'import secureLogger', logPattern: 'secureLogger.log' }
];

// Pattern to ensure no direct console logging of sensitive data
const sensitiveConsoleLogPattern = /console\.log\(.*?(api[_-]?key|token|password|secret|credential|authorization)/i;

// Run tests
let passedCount = 0;
let failedCount = 0;

console.log("Testing for secureLogger implementation in files:");

for (const file of files) {
  console.log(`\nChecking ${file.path}...`);
  const content = safeReadFile(file.path);
  
  if (!content) {
    console.log(`  ⚠️ Could not read file`);
    failedCount++;
    continue;
  }
  
  let filePassed = true;
  
  // Test 1: Check for secureLogger import
  if (content.includes(file.importPattern)) {
    console.log(`  ✓ Imports secureLogger`);
  } else {
    console.log(`  ✗ Does not import secureLogger`);
    filePassed = false;
  }
  
  // Test 2: Check for secureLogger.log usage
  if (content.includes(file.logPattern)) {
    console.log(`  ✓ Uses secureLogger.log`);
  } else {
    console.log(`  ✗ Does not use secureLogger.log`);
    filePassed = false;
  }
  
  // Test 3: Check for sensitive console.log patterns
  if (sensitiveConsoleLogPattern.test(content)) {
    console.log(`  ✗ Contains sensitive data in console.log statements`);
    filePassed = false;
  } else {
    console.log(`  ✓ No sensitive data in console.log statements`);
  }
  
  if (filePassed) {
    console.log(`  ✅ All checks passed for ${file.path}`);
    passedCount++;
  } else {
    console.log(`  ❌ Some checks failed for ${file.path}`);
    failedCount++;
  }
}

// Report results
console.log("\nIntegration Test Summary:");
console.log(`Files checked: ${files.length}`);
console.log(`Passed: ${passedCount}`);
console.log(`Failed: ${failedCount}`);

if (failedCount === 0) {
  console.log("\n✅ All integration tests passed!");
  process.exit(0);
} else {
  console.log("\n❌ Some integration tests failed");
  process.exit(1);
} 