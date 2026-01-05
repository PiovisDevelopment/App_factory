/**
 * scripts/generate_docs_images.js
 * Generates annotated screenshots for the Visual UI Dictionary.
 * Version 2.0 - Robust Selectors & Overlays
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:1420';
const OUTPUT_DIR = path.join(__dirname, '../docs/App_factory_code_refs/images');
const VIEWPORT = { width: 1920, height: 1080 };

// COLORS
const COLORS = {
    RED: 'rgba(239, 68, 68, 0.5)',    // red-500
    BLUE: 'rgba(59, 130, 246, 0.5)',   // blue-500
    GREEN: 'rgba(34, 197, 94, 0.5)',   // green-500
    ORANGE: 'rgba(249, 115, 22, 0.5)', // orange-500
};

// Ensure output directory
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

(async () => {
    console.log('🚀 Starting Robust UI Asset Generation...');
    const browser = await puppeteer.launch({
        headless: "new",
        defaultViewport: VIEWPORT,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // --- Helper: Highlight Function injected into page ---
    const injectHighlighter = async () => {
        await page.addStyleTag({
            content: `
                .docs-highlight-overlay {
                    position: absolute;
                    z-index: 99999;
                    pointer-events: none;
                    border: 4px solid;
                    background-color: rgba(255, 255, 255, 0.1);
                    border-radius: 4px;
                    box-shadow: 0 0 10px rgba(0,0,0,0.3);
                }
                .docs-highlight-label {
                    position: absolute;
                    top: -24px;
                    left: 0;
                    background: #000;
                    color: #fff;
                    padding: 2px 8px;
                    font-size: 12px;
                    border-radius: 4px;
                    white-space: nowrap;
                }
            `
        });
    };

    // --- Helper: Draw Box ---
    const highlight = async (selector, type = 'selector', color = COLORS.BLUE, label = '') => {
        return page.evaluate((sel, t, col, lbl) => {
            let el;
            if (t === 'selector') {
                el = document.querySelector(sel);
            } else if (t === 'text') {
                // Find element containing text
                const all = Array.from(document.querySelectorAll('button, h2, h3, label, span, div'));
                el = all.find(e => e.innerText && e.innerText.includes(sel) && e.offsetParent !== null);
            } else if (t === 'selector-text') {
                // specific selector containing text
                const [css, text] = sel.split('::text=');
                const candidates = Array.from(document.querySelectorAll(css));
                el = candidates.find(e => e.innerText.includes(text));
            }

            if (el) {
                const rect = el.getBoundingClientRect();
                const overlay = document.createElement('div');
                overlay.className = 'docs-highlight-overlay';
                overlay.style.left = rect.left + 'px';
                overlay.style.top = rect.top + 'px';
                overlay.style.width = rect.width + 'px';
                overlay.style.height = rect.height + 'px';
                overlay.style.borderColor = col;

                if (lbl) {
                    const labelDiv = document.createElement('div');
                    labelDiv.className = 'docs-highlight-label';
                    labelDiv.innerText = lbl;
                    labelDiv.style.backgroundColor = col.replace('0.5', '1');
                    overlay.appendChild(labelDiv);
                }

                document.body.appendChild(overlay);
                return true;
            }
            return false;
        }, selector, type, color, label);
    };

    const clearHighlights = async () => {
        await page.evaluate(() => {
            const overlays = document.querySelectorAll('.docs-highlight-overlay');
            overlays.forEach(el => el.remove());
        });
    };

    try {
        await injectHighlighter();

        // --- 1. Launcher Capture ---
        console.log(`Navigating to ${BASE_URL}...`);
        await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
        await new Promise(r => setTimeout(r, 2000));

        const isLauncher = await page.evaluate(() =>
            document.querySelector('h1')?.innerText.includes('App Factory')
        );

        if (isLauncher) {
            console.log("   📸 Capturing Launcher...");
            await highlight('New Project', 'text', COLORS.BLUE, 'New Project Button');
            await highlight('Recent Projects', 'text', COLORS.GREEN, 'Recent Projects');
            // Try to highlight the grid below Recent Projects
            await page.evaluate(() => {
                const h2 = Array.from(document.querySelectorAll('h2')).find(h => h.innerText.includes('Recent Projects'));
                if (h2 && h2.nextElementSibling) {
                    const grid = h2.nextElementSibling;
                    const rect = grid.getBoundingClientRect();
                    // Manually add overlay if standard highlight doesn't work well for siblings
                }
            });

            await page.screenshot({ path: path.join(OUTPUT_DIR, 'launcher_annotated.webp'), type: 'webp' });
            await clearHighlights();

            // Enter Editor
            await page.evaluate(() => {
                Array.from(document.querySelectorAll('button'))
                    .find(b => b.innerText.includes("New Project"))?.click();
            });
            await new Promise(r => setTimeout(r, 2000));
        }

        // --- 2. Main Layout ---
        console.log("   Waiting for Editor...");
        await page.waitForSelector('[data-ui-ref="layout-header"]', { timeout: 10000 });
        await new Promise(r => setTimeout(r, 1000));
        await injectHighlighter(); // Re-inject styles after nav

        console.log("   📸 Capturing Main Layout...");
        await highlight('[data-ui-ref="layout-header"]', 'selector', COLORS.RED, 'Header');
        await highlight('[data-ui-ref="layout-sidebar-left"]', 'selector', COLORS.BLUE, 'Left Sidebar');
        await highlight('[data-ui-ref="layout-center-canvas"]', 'selector', COLORS.GREEN, 'Canvas');
        await highlight('[data-ui-ref="layout-sidebar-right"]', 'selector', COLORS.BLUE, 'Right Sidebar');

        await page.screenshot({ path: path.join(OUTPUT_DIR, 'main_layout_annotated.webp'), type: 'webp' });
        await clearHighlights();

        // --- 3. Components Panel ---
        console.log("   📸 Capturing Components Panel...");
        // Click Tab
        await page.evaluate(() => {
            const sidebar = document.querySelector('[data-ui-ref="layout-sidebar-left"]');
            if (sidebar) {
                // Look for button with text "Comp" (abbreviation used in App.tsx)
                const btn = Array.from(sidebar.querySelectorAll('button'))
                    .find(b => b.textContent.trim() === 'Comp');
                if (btn) btn.click();
            }
        });
        await new Promise(r => setTimeout(r, 2000));

        // Highlight "New Component" button
        await highlight('New Component', 'text', COLORS.BLUE, 'AI Generator');
        // Highlight Component Grid
        await page.evaluate((col) => {
            const btn = Array.from(document.querySelectorAll('button'))
                .find(b => b.textContent.includes('New Component'));
            if (btn && btn.nextElementSibling) {
                const rect = btn.nextElementSibling.getBoundingClientRect();
                const overlay = document.createElement('div');
                overlay.className = 'docs-highlight-overlay';
                overlay.style.left = rect.left + 'px';
                overlay.style.top = rect.top + 'px';
                overlay.style.width = rect.width + 'px';
                overlay.style.height = rect.height + 'px';
                overlay.style.borderColor = col;
                document.body.appendChild(overlay);

                // Add label for grid
                const label = document.createElement('div');
                label.className = 'docs-highlight-label';
                label.innerText = 'Component Library';
                label.style.backgroundColor = col.replace('0.5', '1');
                overlay.appendChild(label);
            }
        }, COLORS.GREEN);

        await page.screenshot({ path: path.join(OUTPUT_DIR, 'tab_components_annotated.webp'), type: 'webp' });
        await clearHighlights();

        // --- 4. Plugins Panel ---
        console.log("   📸 Capturing Plugins Panel...");
        await page.evaluate(() => {
            const sidebar = document.querySelector('[data-ui-ref="layout-sidebar-left"]');
            if (sidebar) {
                // Look for button with text "Plug" (abbreviation used in App.tsx)
                const btn = Array.from(sidebar.querySelectorAll('button'))
                    .find(b => b.textContent.trim() === 'Plug');
                if (btn) btn.click();
            }
        });
        await new Promise(r => setTimeout(r, 2000));

        // Highlight Filters button (Note: Filter button text is inside PluginGallery, may vary)
        // PluginGallery has "Filters" text button only if showFilters is true?
        // App.tsx passes `showViewToggle={false}` to PluginGallery.
        // Let's check PluginGallery source if needed, but for now we look for ANY button in the gallery header.
        // Actually, App.tsx renders: <PluginGallery ... />

        // Highlight First Plugin Card (more specific selector)
        await page.evaluate((col, colOrange) => {
            // 1. Highlight Plugin Cards
            const sidebar = document.querySelector('[data-ui-ref="layout-sidebar-left"]');
            if (sidebar) {
                const cards = Array.from(sidebar.querySelectorAll('div[title]'));
                const validCard = cards.find(c => c.getBoundingClientRect().height > 40);

                if (validCard) {
                    const rect = validCard.getBoundingClientRect();
                    const overlay = document.createElement('div');
                    overlay.className = 'docs-highlight-overlay';
                    overlay.style.left = rect.left + 'px';
                    overlay.style.top = rect.top + 'px';
                    overlay.style.width = rect.width + 'px';
                    overlay.style.height = rect.height + 'px';
                    overlay.style.borderColor = col;
                    document.body.appendChild(overlay);

                    const label = document.createElement('div');
                    label.className = 'docs-highlight-label';
                    label.innerText = 'Plugin Card';
                    label.style.backgroundColor = col.replace('0.5', '1');
                    overlay.appendChild(label);
                }

                // 2. Highlight Category Filter Header (if present, usually "Showing: ...")
                const filterHeader = Array.from(sidebar.querySelectorAll('div')).find(d => d.textContent.includes('Showing:'));
                if (filterHeader) {
                    const rect = filterHeader.getBoundingClientRect();
                    const overlay = document.createElement('div');
                    overlay.className = 'docs-highlight-overlay';
                    overlay.style.left = rect.left + 'px';
                    overlay.style.top = rect.top + 'px';
                    overlay.style.width = rect.width + 'px';
                    overlay.style.height = rect.height + 'px';
                    overlay.style.borderColor = colOrange;
                    document.body.appendChild(overlay);

                    const label = document.createElement('div');
                    label.className = 'docs-highlight-label';
                    label.innerText = 'Active Filters';
                    label.style.backgroundColor = colOrange.replace('0.5', '1');
                    overlay.appendChild(label);
                }
            }
        }, COLORS.BLUE, COLORS.ORANGE);

        await page.screenshot({ path: path.join(OUTPUT_DIR, 'tab_plugins_annotated.webp'), type: 'webp' });
        await clearHighlights();

        // --- 5. Settings Modal ---
        console.log("   📸 Capturing Settings Modal...");
        // Open Settings
        await page.evaluate(() => {
            Array.from(document.querySelectorAll('button'))
                .find(b => b.title === 'Settings' || b.innerText === 'Settings')?.click();
        });
        await new Promise(r => setTimeout(r, 1000));

        // Precise section highlighting
        await highlight('label::text=LLM Provider', 'selector-text', COLORS.RED, 'Select Provider');
        await highlight('label::text=Model', 'selector-text', COLORS.RED, 'Select Model');
        await highlight('textarea#systemPrompt', 'selector', COLORS.GREEN, 'System Prompt Area');
        await highlight('button::text=Test Connection', 'selector-text', COLORS.BLUE, 'Connection Test');

        await page.screenshot({ path: path.join(OUTPUT_DIR, 'modal_settings_annotated.webp'), type: 'webp' });
        await clearHighlights();
        // Close modal
        await page.keyboard.press('Escape');

    } catch (error) {
        console.error("❌ Error:", error);
    } finally {
        await browser.close();
        console.log('✅ Robust Generation complete.');
    }
})();
