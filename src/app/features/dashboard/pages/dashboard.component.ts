import { Component, ChangeDetectionStrategy, OnInit, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DashboardService } from '../../../core/services';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, RouterLink, LoadingComponent, BaseChartDirective],
  template: `
    <div class="dashboard">
      <div class="dashboard-header">
        <h1>Dashboard Analítico</h1>
        <p>Monitor de métricas y cuellos de botella del sistema</p>
      </div>

      @if (dashboardService.loading()) {
        <app-loading />
      } @else if (dashboardService.error()) {
        <div class="error-panel">{{ dashboardService.error() }}</div>
      } @else if (dashboardService.metrics()) {
        <div class="dashboard-content">
          <!-- KPI Cards -->
          <div class="kpi-grid">
            <div class="kpi-card">
              <div class="kpi-label">Trámites Activos / Totales</div>
              <div class="kpi-value">{{ dashboardService.metrics()?.tramitesActivos }} <span class="kpi-sub">/ {{ dashboardService.metrics()?.totalTramites }}</span></div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Tasa Rechazo</div>
              <div class="kpi-value danger">{{ dashboardService.metrics()?.tasaRechazoPorcentual | number:'1.1-1' }}%</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Tiempo Medio Resolución</div>
              <div class="kpi-value warning">{{ dashboardService.metrics()?.tiempoMedioResolucionMinutos | number:'1.0-0' }} <span class="kpi-sub">min</span></div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Actividades Pendientes Totales</div>
              <div class="kpi-value info">{{ dashboardService.metrics()?.actividadesPendientesTotales }}</div>
            </div>
          </div>

          <!-- Charts -->
          <div class="charts-grid">
            <div class="chart-card">
              <h3>Trámites por Estado</h3>
              <div class="chart-container">
                <canvas baseChart
                  [data]="statusChartData()"
                  [options]="doughnutChartOptions"
                  [type]="'doughnut'">
                </canvas>
              </div>
            </div>

            <div class="chart-card">
              <h3>Trámites por Workflow</h3>
              <div class="chart-container">
                <canvas baseChart
                  [data]="workflowChartData()"
                  [options]="barChartOptions"
                  [type]="'bar'">
                </canvas>
              </div>
            </div>
          </div>

          <!-- Bottlenecks Table -->
          <div class="table-card">
            <h3>Cuellos de Botella Identificados</h3>
            @if ((dashboardService.metrics()?.cuellosDeBotella?.length ?? 0) > 0) {
              <div class="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>Nodo / Actividad</th>
                      <th>Tiempo Promedio (min)</th>
                      <th>Pendientes (cola)</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (b of dashboardService.metrics()?.cuellosDeBotella; track b.nodeId) {
                      <tr>
                        <td>{{ b.nodeName }} <span class="badge">{{ b.nodeId }}</span></td>
                        <td class="warning-text">{{ b.averageTimeMinutos | number:'1.1-1' }}</td>
                        <td class="danger-text">{{ b.pendingCount }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            } @else {
              <p class="empty-state">No se identifican cuellos de botella severos actualmente.</p>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .dashboard {
      padding: 2rem;
      max-width: 1400px;
      margin: 0 auto;
      font-family: 'Inter', system-ui, sans-serif;
    }
    .dashboard-header {
      margin-bottom: 2rem;
    }
    .dashboard-header h1 {
      margin: 0;
      color: #1e293b;
      font-size: 1.75rem;
      font-weight: 700;
      letter-spacing: -0.025em;
    }
    .dashboard-header p {
      margin: 0.5rem 0 0;
      color: #64748b;
      font-size: 1rem;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }
    .kpi-card {
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
      border: 1px solid #f1f5f9;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .kpi-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04);
    }
    .kpi-label {
      color: #64748b;
      font-size: 0.875rem;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
    }
    .kpi-value {
      color: #0f172a;
      font-size: 2.25rem;
      font-weight: 700;
      line-height: 1.2;
    }
    .kpi-sub {
      font-size: 1.25rem;
      color: #94a3b8;
      font-weight: 500;
    }
    .kpi-value.danger { color: #ef4444; }
    .kpi-value.warning { color: #f59e0b; }
    .kpi-value.info { color: #3b82f6; }
    
    .charts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
      gap: 2rem;
      margin-bottom: 2rem;
    }
    .chart-card {
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
      border: 1px solid #f1f5f9;
    }
    .chart-card h3 {
      margin: 0 0 1.5rem 0;
      color: #1e293b;
      font-size: 1.125rem;
      font-weight: 600;
    }
    .chart-container {
      position: relative;
      height: 300px;
      width: 100%;
    }
    
    .table-card {
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
      border: 1px solid #f1f5f9;
    }
    .table-card h3 {
      margin: 0 0 1.5rem 0;
      color: #1e293b;
      font-size: 1.125rem;
      font-weight: 600;
    }
    .table-responsive {
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
    }
    th {
      text-align: left;
      padding: 1rem;
      background: #f8fafc;
      color: #475569;
      font-weight: 600;
      font-size: 0.875rem;
      border-bottom: 1px solid #e2e8f0;
    }
    td {
      padding: 1rem;
      color: #1e293b;
      border-bottom: 1px solid #f1f5f9;
      font-size: 0.95rem;
    }
    tr:last-child td {
      border-bottom: none;
    }
    .badge {
      display: inline-block;
      padding: 0.125rem 0.375rem;
      background: #f1f5f9;
      color: #64748b;
      border-radius: 4px;
      font-size: 0.75rem;
      font-family: monospace;
      margin-left: 0.5rem;
    }
    .warning-text { color: #d97706; font-weight: 500; }
    .danger-text { color: #dc2626; font-weight: 500; }
    
    .empty-state {
      text-align: center;
      padding: 3rem;
      color: #64748b;
      font-style: italic;
    }
    .error-panel {
      background: #fef2f2;
      color: #991b1b;
      padding: 1.5rem;
      border-radius: 8px;
      border: 1px solid #fecaca;
    }

    @media (max-width: 768px) {
      .dashboard { padding: 1rem; }
      .charts-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class DashboardComponent implements OnInit {
  dashboardService = inject(DashboardService);

  // Computed data for charts
  statusChartData = computed<ChartData<'doughnut'>>(() => {
    const metrics = this.dashboardService.metrics();
    if (!metrics?.tramitesPorEstado) return { labels: [], datasets: [] };
    
    const statusMap = metrics.tramitesPorEstado;
    const labels = Object.keys(statusMap);
    const data = Object.values(statusMap);
    
    return {
      labels,
      datasets: [{
        data,
        backgroundColor: [
          '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#8b5cf6'
        ],
        borderWidth: 0,
        hoverOffset: 4
      }]
    };
  });

  workflowChartData = computed<ChartData<'bar'>>(() => {
    const metrics = this.dashboardService.metrics();
    if (!metrics?.tramitesPorWorkflowNombre) return { labels: [], datasets: [] };
    
    const wfMap = metrics.tramitesPorWorkflowNombre;
    const labels = Object.keys(wfMap);
    const data = Object.values(wfMap);
    
    return {
      labels,
      datasets: [{
        label: 'Trámites Totales',
        data,
        backgroundColor: '#6366f1',
        borderRadius: 4
      }]
    };
  });

  // Chart configs
  doughnutChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right' }
    }
  };

  barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: { beginAtZero: true, ticks: { precision: 0 } }
    },
    plugins: {
      legend: { display: false }
    }
  };

  ngOnInit(): void {
    this.dashboardService.loadMetrics();
  }
}
