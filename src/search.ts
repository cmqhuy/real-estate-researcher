export class SearchManager {
    private inputEl: HTMLInputElement;
    private resultsEl: HTMLUListElement;
    private searchTimeout: number | null = null;
    private onLocationSelectCallback: ((lat: number, lon: number, zoom: number) => void) | null = null;

    constructor() {
        this.inputEl = document.getElementById('location-search') as HTMLInputElement;
        this.resultsEl = document.getElementById('search-results') as HTMLUListElement;

        this.inputEl.addEventListener('input', () => this.handleInput());
        
        // Hide results when clicking outside
        document.addEventListener('click', (e) => {
            if (e.target !== this.inputEl && e.target !== this.resultsEl) {
                this.hideResults();
            }
        });

        // Handle Enter key for the first result
        this.inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !this.resultsEl.classList.contains('hidden')) {
                const firstItem = this.resultsEl.firstElementChild as HTMLElement;
                if (firstItem) {
                    firstItem.click();
                }
            }
        });
    }

    onLocationSelect(callback: (lat: number, lon: number, zoom: number) => void) {
        this.onLocationSelectCallback = callback;
    }

    private handleInput() {
        const query = this.inputEl.value.trim();
        
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }

        if (query.length < 3) {
            this.hideResults();
            return;
        }

        // Debounce search
        this.searchTimeout = setTimeout(() => {
            this.performSearch(query);
        }, 500) as unknown as number;
    }

    private async performSearch(query: string) {
        try {
            // Append USA to bias results
            const searchQuery = encodeURIComponent(query + ', USA');
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${searchQuery}&addressdetails=1&limit=5`);
            const data = await response.json();
            
            this.showResults(data);
        } catch (error) {
            console.error('Geocoding error:', error);
        }
    }

    private showResults(results: any[]) {
        this.resultsEl.innerHTML = '';
        
        if (results.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'No results found';
            li.style.color = 'var(--color-text-muted)';
            li.style.cursor = 'default';
            this.resultsEl.appendChild(li);
        } else {
            results.forEach(result => {
                const li = document.createElement('li');
                li.textContent = result.display_name;
                
                li.addEventListener('click', () => {
                    this.inputEl.value = result.display_name;
                    this.hideResults();
                    
                    if (this.onLocationSelectCallback) {
                        // Determine appropriate zoom level based on result type
                        let zoom = 11; // Default city level
                        if (result.type === 'administrative' && result.class === 'boundary') {
                            zoom = 6; // State level
                        } else if (result.type === 'postcode') {
                            zoom = 13; // Zip code level
                        }
                        
                        this.onLocationSelectCallback(parseFloat(result.lat), parseFloat(result.lon), zoom);
                    }
                });
                
                this.resultsEl.appendChild(li);
            });
        }
        
        this.resultsEl.classList.remove('hidden');
    }

    private hideResults() {
        this.resultsEl.classList.add('hidden');
    }
}
