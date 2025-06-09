/**
 * Test runner for the secure logging utility tests
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Find all test files recursively
function findTestFiles(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  let testFiles = [];
  
  for (const file of files) {
    const fullPath = path.resolve(dir, file.name);
    if (file.isDirectory()) {
      testFiles = testFiles.concat(findTestFiles(fullPath));
    } else if (file.name.endsWith('.test.js')) {
      testFiles.push(fullPath);
    }
  }
  
  return testFiles;
}

// Run tests
async function runTests() {
  console.log('Finding test files...');
  const testFiles = findTestFiles(__dirname);
  console.log(`Found ${testFiles.length} test files.`);
  
  let allTestsPassed = true;
  let totalPassed = 0;
  let totalFailed = 0;
  
  for (const testFile of testFiles) {
    console.log(`\n${'-'.repeat(80)}`);
    console.log(`Running test: ${testFile}`);
    console.log(`${'-'.repeat(80)}`);
    
    // Using Node.js to run the test file
    const nodeProcess = spawn('node', [testFile], {
      stdio: 'inherit' // Forward stdout/stderr to parent process
    });
    
    // Wait for the process to complete
    const exitCode = await new Promise(resolve => {
      nodeProcess.on('close', code => {
        resolve(code);
      });
    });
    
    if (exitCode !== 0) {
      allTestsPassed = false;
      totalFailed++;
    } else {
      totalPassed++;
    }
  }
  
  console.log(`\n${'-'.repeat(80)}`);
  console.log('Test summary:');
  console.log(`Total test files: ${testFiles.length}`);
  console.log(`Passed: ${totalPassed}`);
  console.log(`Failed: ${totalFailed}`);
  
  process.exit(allTestsPassed ? 0 : 1);
}

runTests().catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
}); 