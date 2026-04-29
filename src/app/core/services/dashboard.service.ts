import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DashboardMetricsResponse } from '../../shared/models';
import { environment } from '../config/environment';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;
  
  private _metrics = signal<DashboardMetricsResponse | null>(null);
  private _loading = signal<boolean>(false);
  private _error = signal<string | null>(null);

  readonly metrics = computed(() => this._metrics());
  readonly loading = computed(() => this._loading());
  readonly error = computed(() => this._error());

  loadMetrics() {
    this._loading.set(true);
    this._error.set(null);
    this.http.get<DashboardMetricsResponse>(`${this.apiUrl}/dashboard/metrics`).subscribe({
      next: (data) => {
        this._metrics.set(data);
        this._loading.set(false);
      },
      error: (err) => {
        this._error.set(err.message || 'Error loading dashboard metrics');
        this._loading.set(false);
      }
    });
  }
}
