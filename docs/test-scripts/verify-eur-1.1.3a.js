/**
 * EUR-1.1.3a Verification Test
 * ============================
 * Manual test script to verify AI-generated components use design tokens.
 * 
 * Run this in the Tauri app's DevTools console (press F12).
 */

// Test 1: Check the prompt template contains design tokens
const checkPromptTemplate = () => {
    console.log('%c=== EUR-1.1.3a Verification ===', 'color: #10b981; font-weight: bold; font-size: 16px;');

    // Import the design token reference
    import('/src/hooks/useComponentGenerator.ts').then(module => {
        if (module.DESIGN_TOKEN_REFERENCE) {
            console.log('%c✓ DESIGN_TOKEN_REFERENCE is exported', 'color: #10b981;');
            console.log('Design Token Reference:', module.DESIGN_TOKEN_REFERENCE.substring(0, 200) + '...');
        } else {
            console.log('%c✗ DESIGN_TOKEN_REFERENCE not found', 'color: #ef4444;');
        }
    }).catch(err => {
        console.log('%c⚠ Could not dynamically import (module bundled)', 'color: #f59e0b;');
        console.log('This is expected in production. Test via UI instead.');
    });
};

// Test 2: Verify via generated code analysis
const testInstructions = `
%c=== Manual Test Instructions ===

1. Go to "Generate" tab in the sidebar
2. Enter prompt: "A primary button with hover effect"
3. Click "Generate Component"
4. Check the generated code for:
   
   ✓ PASS if code contains:
     - bg-primary-600 or similar primary colors
     - hover:bg-primary-700 for hover effects
     - rounded-md or similar Tailwind classes
   
   ✗ FAIL if code contains:
     - style={{ backgroundColor: '...' }}
     - Inline style objects
     - Hardcoded hex colors (#3b82f6)

5. Report results to the developer
`;

console.log(testInstructions, 'color: #0ea5e9; font-size: 14px;');

// Run the check
checkPromptTemplate();
