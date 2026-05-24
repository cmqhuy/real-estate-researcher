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
                consoleErrors.push(msg.text());
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

        const stateSelect = page.locator('#state-select');
        await stateSelect.selectOption('WA');

        // State select should show WA
        await expect(stateSelect).toHaveValue('WA');
    });

    test('should show search suggestions', async ({ page }) => {
        await page.goto('./');

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
});
