import type { MetricType } from './colors';

export class SidebarManager {
    private activeMetric: MetricType = 'homeValue';
    private onMetricChangeCallback: ((metric: MetricType) => void) | null = null;

    constructor() {
        const options = document.querySelectorAll('.metric-option');
        
        options.forEach(option => {
            const input = option.querySelector('input') as HTMLInputElement;
            
            option.addEventListener('click', (e) => {
                if (e.target !== input) {
                    input.checked = true;
                }
                
                // Update UI
                options.forEach(opt => opt.classList.remove('active'));
                option.classList.add('active');
                
                // Notify
                const newMetric = input.value as MetricType;
                if (newMetric !== this.activeMetric) {
                    this.activeMetric = newMetric;
                    if (this.onMetricChangeCallback) {
                        this.onMetricChangeCallback(this.activeMetric);
                    }
                }
            });
        });
    }

    onMetricChange(callback: (metric: MetricType) => void) {
        this.onMetricChangeCallback = callback;
    }

    getActiveMetric(): MetricType {
        return this.activeMetric;
    }
}
