import { test, expect } from '@playwright/test';

test.describe('Real Estate Researcher App', () => {
    let consoleErrors: string[] = [];
    let pageErrors: Error[] = [];

    test.beforeEach(({ page }) => {
        consoleErrors = [];
        pageErrors = [];
        
        // Listen to console and page errors to catch crashes
        page.on('console', msg => {
            if (msg.type() === 'error') {
                const text = msg.text();
                // Ignore network/tile resource loading errors as they can flake on CI due to rate limiting
                if (text.includes('Failed to load resource') || text.includes('cartocdn') || text.includes('tile')) {
                    return;
                }
                consoleErrors.push(text);
            }
        });
        page.on('pageerror', exception => {
            pageErrors.push(exception);
        });
    });

    test.afterEach(() => {
        // Assert that no uncaught exceptions occurred during E2E runs
        expect(pageErrors).toEqual([]);
        expect(consoleErrors).toEqual([]);
    });

    test('should load app, render map, and hide loading overlay', async ({ page }) => {
        await page.goto('./');
        await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/, { timeout: 30000 });
        
        // Assert title
        await expect(page).toHaveTitle('Real Estate Researcher');
        
        // Assert map container is visible
        const mapContainer = page.locator('#map-container');
        await expect(mapContainer).toBeVisible();

        // Assert search search box exists
        const searchInput = page.locator('#location-search');
        await expect(searchInput).toBeVisible();

        // Assert level selector buttons are visible
        const levelSelector = page.locator('#level-selector');
        await expect(levelSelector).toBeVisible();
        await expect(page.locator('.level-btn[data-level="zip"]')).toHaveClass(/active/);

        // Assert default legend exists
        const legendTitle = page.locator('#legend-title');
        await expect(legendTitle).toHaveText('Home Value');
    });

    test('should switch metrics and update legend', async ({ page }) => {
        await page.goto('./');
        await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/, { timeout: 30000 });

        // On mobile, the sidebar drawer is hidden by default. If the menu toggle is visible, open the drawer.
        const menuToggle = page.locator('#menu-toggle');
        if (await menuToggle.isVisible()) {
            await menuToggle.click();
            await expect(page.locator('.sidebar')).toHaveClass(/open/);
        }

        // Click rent value option in sidebar
        const rentOptionInput = page.locator('input[value="rentValue"]');
        // Click the label/wrapper element
        await rentOptionInput.locator('..').click();

        // Assert active metric UI state in sidebar
        await expect(rentOptionInput.locator('..')).toHaveClass(/active/);

        // Legend title should update
        const legendTitle = page.locator('#legend-title');
        await expect(legendTitle).toHaveText('Monthly Rent');
    });

    test('should switch geographic levels', async ({ page }) => {
        await page.goto('./');
        await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/, { timeout: 30000 });

        const countyBtn = page.locator('.level-btn[data-level="county"]');
        await countyBtn.click();

        // Button should become active
        await expect(countyBtn).toHaveClass(/active/);
        await expect(page.locator('.level-btn[data-level="zip"]')).not.toHaveClass(/active/);

        // Switch to metro level
        const metroBtn = page.locator('.level-btn[data-level="metro"]');
        await metroBtn.click();
        await expect(metroBtn).toHaveClass(/active/);
    });

    test('should switch states and center map', async ({ page }) => {
        await page.goto('./');
        await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/, { timeout: 30000 });

        const stateSelect = page.locator('#state-select');
        await stateSelect.selectOption('WA');

        // State select should show WA
        await expect(stateSelect).toHaveValue('WA');
    });

    test('should show search suggestions', async ({ page }) => {
        await page.goto('./');
        await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/, { timeout: 30000 });

        const searchInput = page.locator('#location-search');
        await searchInput.fill('Dallas');

        // Wait for search suggestions list
        const resultsList = page.locator('#search-results');
        await expect(resultsList).not.toHaveClass(/hidden/);
        
        // Assert suggestion items are rendered
        const suggestionItems = resultsList.locator('li');
        await expect(suggestionItems.first()).toBeVisible();
    });

    test.describe('Mobile Viewport Specific Interactions', () => {
        test.use({ viewport: { width: 375, height: 667 } });

        test('should toggle sidebar drawer and consolidate metrics change', async ({ page }) => {
            await page.goto('./');
            await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/, { timeout: 30000 });

            const sidebar = page.locator('.sidebar');
            const menuToggle = page.locator('#menu-toggle');
            const menuClose = page.locator('#menu-close');
            const backdrop = page.locator('#sidebar-backdrop');

            // Sidebar should be off-screen by default
            await expect(sidebar).not.toHaveClass(/open/);

            // Open drawer
            await menuToggle.click();
            await expect(sidebar).toHaveClass(/open/);
            await expect(backdrop).toHaveClass(/active/);

            // Select a metric in the drawer - should close drawer automatically on selection
            const rentOption = page.locator('input[value="rentValue"]').locator('..');
            await rentOption.click();
            await expect(sidebar).not.toHaveClass(/open/);
            await expect(backdrop).not.toHaveClass(/active/);
            
            // Map should update to rent metric
            await expect(page.locator('#legend-title')).toHaveText('Monthly Rent');

            // Toggle open and close manually
            await menuToggle.click();
            await expect(sidebar).toHaveClass(/open/);
            await menuClose.click();
            await expect(sidebar).not.toHaveClass(/open/);
        });
    });

    test.describe('Interactive Popups & Deep Linking', () => {
        test('should open popup on click, display correct header, and update URL parameters', async ({ page }) => {
            await page.goto('./');
            await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/, { timeout: 30000 });
            await page.waitForTimeout(1000);

            // Click on the map container (center coordinates) to select a region
            const mapContainer = page.locator('#map-container');
            const box = await mapContainer.boundingBox();
            await mapContainer.click({
                position: {
                    x: box ? box.width / 2 : 500,
                    y: box ? box.height / 2 : 300
                }
            });

            // Assert popup is visible
            const popup = page.locator('.custom-map-popup');
            await expect(popup).toBeVisible();

            // Assert popup has header and metric value
            const header = popup.locator('.map-popup-header');
            await expect(header).not.toBeEmpty();
            
            const value = popup.locator('.map-popup-metric-value');
            await expect(value).not.toBeEmpty();

            // Assert URL parameter 'selected' is updated
            await expect(page).toHaveURL(/selected=/);
        });

        test('should switch metric inside popup and synchronize with map, sidebar, and URL', async ({ page }) => {
            await page.goto('./');
            await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/, { timeout: 30000 });
            await page.waitForTimeout(1000);

            // Click to open popup
            const mapContainer = page.locator('#map-container');
            const box = await mapContainer.boundingBox();
            await mapContainer.click({
                position: {
                    x: box ? box.width / 2 : 500,
                    y: box ? box.height / 2 : 300
                }
            });
            const popup = page.locator('.custom-map-popup');
            await expect(popup).toBeVisible();

            // Get selector and change to rentValue
            const select = popup.locator('#popup-metric-select');
            await select.selectOption('rentValue');

            // Assert URL metric is updated
            await expect(page).toHaveURL(/metric=rentValue/);

            // Assert sidebar metric option is active
            const rentOptionInput = page.locator('input[value="rentValue"]');
            await expect(rentOptionInput.locator('..')).toHaveClass(/active/);

            // Assert legend is updated
            await expect(page.locator('#legend-title')).toHaveText('Monthly Rent');
        });

        test('should initialize from deep link, zoom to region, and open popup', async ({ page }) => {
            // Load TX, county level, homeValue metric, selected Harris County (FIPS 48201)
            await page.goto('./?state=TX&level=county&metric=homeValue&selected=48201');
            await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/, { timeout: 30000 });

            // Assert state selector is TX
            await expect(page.locator('#state-select')).toHaveValue('TX');

            // Assert level selector active is county
            await expect(page.locator('.level-btn[data-level="county"]')).toHaveClass(/active/);

            // Assert popup is visible and displays Harris County
            const popup = page.locator('.custom-map-popup');
            await expect(popup).toBeVisible();
            await expect(popup.locator('.map-popup-header')).toContainText('Harris County');
        });
    });
});
