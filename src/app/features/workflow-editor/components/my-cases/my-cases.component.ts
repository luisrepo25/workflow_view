import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProcessInstanceService } from '../../../../core/services/process-instance.service';
import { UserListItem, WorkflowService } from '../../../../core/services/workflow.service';
import { AuthService } from '../../../../core/services/auth.service';
import { WorkflowListItem } from '../../../../shared/models';

@Component({
  selector: 'app-my-cases',
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="page-header">
        <h1>Mis casos</h1>
        <p>Seguimiento de trámites y procesos en curso.</p>
      </header>

      <section class="card create-card">
        <h2>Crear nuevo trámite</h2>
        <div class="form-grid">
          <label>
            Workflow
            <select [(ngModel)]="selectedWorkflowId">
              <option value="">Selecciona un workflow</option>
              @for (workflow of workflows(); track workflow.id) {
                <option [value]="workflow.id">{{ workflow.codigo }} - {{ workflow.nombre }}</option>
              }
            </select>
          </label>

          <fieldset class="client-section">
            <legend>Datos del Cliente</legend>
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="createNewClient" />
              Registrar nuevo cliente
            </label>

            @if (createNewClient) {
              <div class="client-form">
                <label>
                  Correo
                  <input type="email" [(ngModel)]="newClientEmail" placeholder="cliente@email.com" />
                </label>
                <label>
                  Contraseña
                  <input type="password" [(ngModel)]="newClientPassword" placeholder="••••••••" />
                </label>
              </div>
            } @else {
              <label>
                Cliente existente
                <select [(ngModel)]="existingClienteId">
                  <option value="">Selecciona un cliente</option>
                  @for (client of existingClients(); track client.id) {
                    <option [value]="client.id">{{ client.nombre }} ({{ client.id }})</option>
                  }
                </select>
              </label>
              @if (clientsLoading()) {
                <p class="hint">Cargando clientes...</p>
              }
              @if (clientsLoadError()) {
                <p class="error">{{ clientsLoadError() }}</p>
              }
              @if (!clientsLoading() && !clientsLoadError() && existingClients().length === 0) {
                <p class="hint">No hay clientes activos disponibles para seleccionar.</p>
              }
            }
          </fieldset>

          <label>
            Datos iniciales (JSON)
            <textarea rows="3" [(ngModel)]="initialDataText" placeholder='{"numeroSolicitud":"SOL-2026-0001"}'></textarea>
          </label>
        </div>

        <div class="actions">
          <button type="button" (click)="onCreateCase()" [disabled]="!canCreate() || processService.isLoading() || isCreatingClient">
            {{ processService.isLoading() || isCreatingClient ? 'Procesando...' : 'Crear trámite' }}
          </button>
        </div>

        @if (createError()) {
          <p class="error">{{ createError() }}</p>
        }
        @if (workflowLoadError()) {
          <p class="error">{{ workflowLoadError() }}</p>
        }
      </section>

      <section class="card list-card">
        <div class="list-header">
          <h2>Trámites del cliente</h2>
          <button type="button" class="secondary" (click)="reload()">Actualizar</button>
        </div>

        @if (processService.isLoading()) {
          <p>Cargando trámites...</p>
        } @else if (processes().length === 0) {
          <div class="empty-state">No hay trámites registrados todavía.</div>
        } @else {
          <div class="cases-grid">
            @for (process of processes(); track process.id) {
              <article class="case-card">
                <div class="case-head">
                  <strong>{{ process.codigo }}</strong>
                  <span class="badge" [attr.data-status]="process.estado">{{ process.estado }}</span>
                </div>
                <p class="muted">Workflow: {{ process.workflowNombre || process.workflowCodigo || process.workflowId }}</p>
                <p class="muted">Actualizado: {{ process.updatedAt | date:'short' }}</p>
                <p class="muted">Nodos activos: {{ process.currentNodeIds.join(', ') || '-' }}</p>
              </article>
            }
          </div>
        }
      </section>
    </section>
  `,
  styles: [`
    .page { padding: 24px; display: grid; gap: 16px; }
    .page-header h1 { margin: 0 0 8px; }
    .page-header p { margin: 0; color: #64748b; }
    .card { border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; padding: 16px; }
    h2 { margin: 0 0 12px; font-size: 18px; }
    .form-grid { display: grid; gap: 12px; }
    label { display: grid; gap: 6px; color: #334155; font-size: 14px; }
    input, select, textarea { width: 100%; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; box-sizing: border-box; }
    .actions { margin-top: 12px; }
    button { border: none; border-radius: 8px; background: #0f172a; color: #fff; padding: 10px 14px; cursor: pointer; }
    button.secondary { background: #f1f5f9; color: #0f172a; border: 1px solid #cbd5e1; }
    button:disabled { opacity: .5; cursor: not-allowed; }
    .error { margin: 10px 0 0; color: #b91c1c; font-size: 13px; }
    .list-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .cases-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px; }
    .case-card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; background: #f8fafc; }
    .case-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .badge { border-radius: 999px; padding: 2px 8px; font-size: 12px; background: #e2e8f0; color: #1e293b; text-transform: capitalize; }
    .badge[data-status='aprobado'], .badge[data-status='finalizado'] { background: #dcfce7; color: #166534; }
    .badge[data-status='rechazado'], .badge[data-status='cancelado'] { background: #fee2e2; color: #991b1b; }
    .muted { margin: 6px 0 0; color: #64748b; font-size: 13px; }
    .empty-state { padding: 24px; border: 1px dashed #cbd5e1; border-radius: 12px; color: #475569; background: #f8fafc; }
    .client-section { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-top: 8px; margin-bottom: 8px; }
    .client-section legend { font-size: 14px; font-weight: 500; color: #475569; padding: 0 4px; }
    .checkbox-label { display: flex; align-items: center; flex-direction: row; gap: 8px; cursor: pointer; }
    .checkbox-label input { width: auto; }
    .client-form { display: grid; gap: 8px; margin-top: 8px; padding-top: 8px; border-top: 1px dashed #e2e8f0; }
    .hint { margin: 8px 0 0; color: #64748b; font-size: 12px; }
  `]
})
export class MyCasesComponent {
  readonly processService = inject(ProcessInstanceService);
  private readonly workflowService = inject(WorkflowService);
  private readonly authService = inject(AuthService);

  readonly processes = this.processService.processInstances;
  readonly workflows = signal<WorkflowListItem[]>([]);
  readonly workflowLoadError = signal<string | null>(null);
  selectedWorkflowId = '';
  initialDataText = '{}';
  readonly createError = signal<string | null>(null);

  // Client fields
  createNewClient = false;
  newClientEmail = '';
  newClientPassword = '';
  existingClienteId = '';
  isCreatingClient = false;
  readonly clientsLoading = signal(false);
  readonly clientsLoadError = signal<string | null>(null);
  readonly existingClients = signal<UserListItem[]>([]);

  constructor() {
    this.reload();
    this.loadWorkflows();
    this.loadClients();
  }

  canCreate(): boolean {
    return !!this.selectedWorkflowId && (this.createNewClient ? (!!this.newClientEmail && !!this.newClientPassword) : !!this.existingClienteId);
  }

  reload(): void {
    this.processService.listMyProcesses().subscribe();
  }

  onCreateCase(): void {
    this.createError.set(null);

    const user = this.authService.currentUser();
    if (!user) {
      this.createError.set('Debes iniciar sesión para crear un trámite.');
      return;
    }

    if (!this.selectedWorkflowId) {
      this.createError.set('Selecciona un workflow.');
      return;
    }

    let parsedData: Record<string, unknown> = {};
    try {
      parsedData = JSON.parse(this.initialDataText || '{}') as Record<string, unknown>;
    } catch {
      this.createError.set('El campo de datos iniciales debe ser JSON válido.');
      return;
    }

    if (this.createNewClient) {
      this.isCreatingClient = true;
      this.authService.registerWithoutLogin({
        nombre: 'Cliente ' + this.newClientEmail.split('@')[0],
        email: this.newClientEmail,
        password: this.newClientPassword,
        role: 'Cliente'
      }).subscribe({
        next: (res) => {
          this.isCreatingClient = false;
          // Use the newly created user's ID
          this.executeCreateProcess(this.selectedWorkflowId, res.user.id, parsedData);
        },
        error: (err) => {
          this.isCreatingClient = false;
          this.createError.set('Error al registrar nuevo cliente.');
          console.error(err);
        }
      });
    } else {
      if (!this.existingClienteId) {
        this.createError.set('Debes especificar un ID de cliente.');
        return;
      }
      this.executeCreateProcess(this.selectedWorkflowId, this.existingClienteId, parsedData);
    }
  }

  private executeCreateProcess(workflowId: string, clienteId: string, datosIniciales: Record<string, unknown>) {
    this.processService.createProcessInstance({
      workflowId,
      clienteId,
      datosIniciales
    }).subscribe({
      next: () => {
        this.initialDataText = '{}';
        this.newClientEmail = '';
        this.newClientPassword = '';
        this.existingClienteId = '';
        this.createNewClient = false;
        // Optionally reload the list
        this.reload();
      },
      error: () => {
        this.createError.set(this.processService.error() ?? 'No se pudo crear el trámite.');
      }
    });
  }

  private loadWorkflows(): void {
    this.workflowLoadError.set(null);
    this.workflowService.listActiveWorkflowsForProcesses().subscribe({
      next: (items) => {
        this.workflows.set(items || []);
        if (!this.selectedWorkflowId && items.length > 0) {
          this.selectedWorkflowId = items[0].id;
        }
      },
      error: (error: any) => {
        this.workflows.set([]);
        const backendMessage = error?.error?.message || error?.message;
        this.workflowLoadError.set(backendMessage || 'No se pudieron cargar workflows activos para creación de trámites.');
      }
    });
  }

  private loadClients(): void {
    this.clientsLoading.set(true);
    this.clientsLoadError.set(null);

    this.workflowService.listUsers({ role: 'Cliente', activo: true }).subscribe({
      next: (items) => {
        const sorted = (items || []).slice().sort((a, b) => a.nombre.localeCompare(b.nombre));
        this.existingClients.set(sorted);
        this.clientsLoading.set(false);
      },
      error: (error: any) => {
        this.existingClients.set([]);
        this.clientsLoading.set(false);
        const backendMessage = error?.error?.message || error?.message;
        this.clientsLoadError.set(backendMessage || 'No se pudieron cargar los clientes.');
      }
    });
  }
}
