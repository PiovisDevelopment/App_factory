/**
 * scripts/capture_ui.js
 * Automates screenshot capture for App Factory documentation using Puppeteer.
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const BASE_URL = 'http://localhost:1420';
const OUTPUT_DIR = path.join(__dirname, '../docs/App_factory_code_refs/images');
const VIEWPORT = { width: 1920, height: 1080 };

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

(async () => {
    console.log('🚀 Starting UI Capture...');

    const browser = await puppeteer.launch({
        headless: "new",
        defaultViewport: VIEWPORT,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // 2. Define Capture Function with Metadata Extraction
    const captureState = async (stateName, actions = async () => { }) => {
        console.log(`\n📸 Capturing State: ${stateName}`);

        // Perform actions (navigation, clicks)
        await actions();

        // Wait for potential animations
        await new Promise(r => setTimeout(r, 1000));

        // Find all elements with data-ui-ref
        const uiRefs = await page.evaluate(() => {
            const elements = document.querySelectorAll('[data-ui-ref]');
            const map = {};
            elements.forEach(el => {
                const rect = el.getBoundingClientRect();
                const id = el.getAttribute('data-ui-ref');
                // Only save if visible (width/height > 0)
                if (rect.width > 0 && rect.height > 0) {
                    map[id] = {
                        x: rect.x,
                        y: rect.y,
                        width: rect.width,
                        height: rect.height,
                        label: id
                    };
                }
            });
            return map;
        });

        console.log(`   Found ${Object.keys(uiRefs).length} UI references.`);

        // Take Screenshot
        const screenshotFilename = `state_${stateName}.webp`;
        await page.screenshot({
            path: path.join(OUTPUT_DIR, screenshotFilename),
            type: 'webp',
            quality: 90
        });

        return {
            image: screenshotFilename,
            refs: uiRefs
        };
    };

    const manifest = {
        generatedAt: new Date().toISOString(),
        states: []
    };

    try {
        // 1. Initial Load
        console.log(`Navigating to ${BASE_URL}...`);
        await page.goto(BASE_URL, { waitUntil: 'networkidle0' });

        // Wait for render
        await new Promise(r => setTimeout(r, 2000));

        // 2. Handle Launcher (transition to Editor)
        // Check for "App Factory" or "Projects" which indicates Launcher
        const isLauncher = await page.evaluate(() => {
            const h1 = document.querySelector('h1');
            return h1 && h1.innerText.includes('App Factory');
        });

        if (isLauncher) {
            console.log("   Detected Launcher. Searching for 'New Project' button...");

            // Use page.evaluate to find the button - Robust and Puppeteer version agnostic
            const buttonFound = await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                const target = buttons.find(b => b.innerText.includes("New Project"));
                if (target) {
                    target.click();
                    return true;
                }
                return false;
            });

            if (buttonFound) {
                console.log("   Clicked 'New Project'. Waiting for Editor transition...");

                // Wait specifically for the header which has the data-ui-ref we added
                try {
                    await page.waitForSelector('[data-ui-ref="layout-header"]', { timeout: 10000 });
                    console.log("   ✅ Editor loaded successfully.");
                } catch (e) {
                    console.warn("   ⚠️ Timed out waiting for Editor layout selector.");
                }
            } else {
                console.error("   ❌ Could not find 'New Project' button.");
                // Try fallback: finding ANY button with 'New' or 'Project'
                const fallbackClicked = await page.evaluate(() => {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const fb = buttons.find(b => b.innerText.includes('New')) || buttons[0];
                    if (fb) { fb.click(); return true; }
                    return false;
                });
                if (fallbackClicked) {
                    console.log("   Attempting fallback click on first button found...");
                    await new Promise(r => setTimeout(r, 2000));
                }
            }
        } else {
            console.log("   Already in Editor (or unknown state).");
        }

        // Give it a moment to settle
        await new Promise(r => setTimeout(r, 2000));

        // 3. Capture States

        // State: Main Layout
        manifest.states.push({
            id: "main_layout",
            title: "Main Layout",
            data: await captureState('main_layout')
        });

        // State: Components Tab
        console.log("   Switching to Components Tab...");
        const compTabClicked = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            // Looking for "Comp" tab (title="Comp" or text="Comp")
            const compBtn = buttons.find(b => b.title === 'Comp' || b.innerText.includes('Comp'));
            if (compBtn) {
                compBtn.click();
                return true;
            }
            return false;
        });

        if (compTabClicked) {
            manifest.states.push({
                id: "tab_components",
                title: "Components Panel",
                data: await captureState('tab_components')
            });
        }

        // Capture Settings Modal
        console.log("   Opening Settings...");
        const settingsClicked = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            // Assuming settings icon button or title="Settings"
            const settingsBtn = buttons.find(b => b.title === 'Settings');
            if (settingsBtn) {
                settingsBtn.click();
                return true;
            }
            return false;
        });

        if (settingsClicked) {
            manifest.states.push({
                id: "modal_settings",
                title: "Settings Modal",
                data: await captureState('modal_settings')
            });
            // Close modal
            await page.keyboard.press('Escape');
        }

        // Save Manifest
        fs.writeFileSync(path.join(OUTPUT_DIR, 'ui_manifest.json'), JSON.stringify(manifest, null, 2));
        console.log(`✅ Manifest saved to ui_manifest.json`);

    } catch (error) {
        console.error('❌ Error during capture:', error);
    } finally {
        await browser.close();
        console.log('✅ Capture complete.');
    }
})();
