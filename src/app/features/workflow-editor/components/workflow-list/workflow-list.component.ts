import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { WorkflowService } from '../../../../core/services/workflow.service';
import { WorkflowListItem } from '../../../../shared/models/workflow.model';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-workflow-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <div class="header">
        <h2>Mis Workflows</h2>
        <button class="btn btn-primary" (click)="onCreateWorkflow()">+ Crear Workflow</button>
      </div>

      <!-- Modal para crear workflow -->
      <div class="modal" *ngIf="showCreateModal">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Crear Nuevo Workflow</h3>
            <button class="close-btn" (click)="showCreateModal = false">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Código (ID único)</label>
              <input type="text" 
                     [(ngModel)]="newWorkflow.codigo" 
                     placeholder="ej: PROC_APROBACION"
                     class="form-input">
            </div>
            <div class="form-group">
              <label>Nombre</label>
              <input type="text" 
                     [(ngModel)]="newWorkflow.nombre" 
                     placeholder="ej: Proceso de Aprobación"
                     class="form-input">
            </div>
            <div class="form-group">
              <label>Descripción</label>
              <textarea [(ngModel)]="newWorkflow.descripcion" 
                        placeholder="Describe el propósito del workflow"
                        class="form-textarea"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="showCreateModal = false">Cancelar</button>
            <button class="btn btn-primary" 
                    (click)="submitCreateWorkflow()"
                    [disabled]="!newWorkflow.codigo || !newWorkflow.nombre || isCreating">
              {{ isCreating ? 'Creando...' : 'Crear' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Listado de workflows -->
      <div class="workflows-list">
        <div *ngIf="isLoading" class="loading">Cargando workflows...</div>
        
        <div *ngIf="!isLoading && workflows().length === 0" class="empty-state">
          <p>No hay workflows aún. ¡Crea uno para comenzar!</p>
        </div>

        <div class="workflow-card" *ngFor="let wf of workflows()">
          <div class="card-header">
            <h4>{{ wf.nombre }}</h4>
            <span class="badge" [ngClass]="'badge-' + wf.estado">{{ wf.estado }}</span>
          </div>
          <div class="card-body">
            <p class="codigo"><strong>Código:</strong> {{ wf.codigo }}</p>
            <p class="descripcion">{{ wf.descripcion }}</p>
            <p class="meta">
              <small>Por: {{ wf.createdBy }} | Actualizado: {{ wf.updatedAt | date:'short' }}</small>
            </p>
          </div>
          <div class="card-footer">
            <button class="btn btn-sm btn-primary" (click)="onEditWorkflow(wf.id)">Editar</button>
            <button class="btn btn-sm btn-secondary" (click)="onManageCollaborators(wf.id)">Invitaciones</button>
            
            <button *ngIf="wf.estado === 'borrador' || wf.estado === 'inactivo'" 
                    class="btn btn-sm btn-success btn-full" 
                    [disabled]="isActivating === wf.id"
                    (click)="onActivateWorkflow(wf)">
              {{ isActivating === wf.id ? 'Validando...' : 'Activar' }}
            </button>

            <button *ngIf="wf.estado === 'activo'" 
                    class="btn btn-sm btn-warning btn-full" 
                    (click)="onDeactivateWorkflow(wf.id)">
              Desactivar
            </button>

            <button class="btn btn-sm btn-danger btn-full" (click)="onDeleteWorkflow(wf.id)">Eliminar</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .container {
      padding: 24px;
      max-width: 1200px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 32px;
    }
    .header h2 {
      margin: 0;
      font-size: 24px;
      color: #0f172a;
      font-weight: 700;
    }
    .btn {
      padding: 10px 16px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      background: white;
      cursor: pointer;
      font-weight: 500;
      font-size: 14px;
      transition: all 0.2s;
    }
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      background: white;
      color: #334155; /* Explicit color to fix contrast issues */
      cursor: pointer;
      font-weight: 500;
      font-size: 14px;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .btn:hover {
      background: #f8fafc;
      border-color: #cbd5e1;
      color: #0f172a;
    }
    .btn-primary {
      background: #3b82f6;
      color: white !important;
      border-color: #2563eb;
    }
    .btn-primary:hover {
      background: #2563eb;
      box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.2);
    }
    .btn-primary:disabled {
      background: #94a3b8;
      border-color: #94a3b8;
      cursor: not-allowed;
    }
    .btn-sm {
      padding: 6px 12px;
      font-size: 12px;
    }
    .btn-danger {
      color: #ef4444;
      border-color: #fecaca;
      background: #fff1f2;
    }
    .btn-danger:hover {
      background: #fee2e2;
      border-color: #fca5a5;
      color: #dc2626;
    }
    .btn-secondary {
      background: #f1f5f9;
      color: #475569;
      border-color: #e2e8f0;
    }
    .btn-secondary:hover {
      background: #e2e8f0;
      color: #1e293b;
    }

    /* Modal Styles */
    .modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(15, 23, 42, 0.5);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      animation: fadeIn 0.2s ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    
    .modal-content {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      max-width: 500px;
      width: 90%;
      overflow: hidden;
      animation: scaleIn 0.2s ease;
    }
    @keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      border-bottom: 1px solid #f1f5f9;
    }
    .modal-header h3 {
      margin: 0;
      color: #0f172a;
      font-size: 18px;
      font-weight: 600;
    }
    .close-btn {
      background: #f1f5f9;
      border: none;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: #64748b;
      transition: all 0.2s;
    }
    .close-btn:hover { background: #e2e8f0; color: #0f172a; }
    
    .modal-body { padding: 24px; }
    .form-group { margin-bottom: 20px; }
    .form-group label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #475569;
      margin-bottom: 8px;
    }
    .form-input, .form-textarea {
      width: 100%;
      box-sizing: border-box;
      padding: 12px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-size: 14px;
      color: #1e293b;
      background: #f8fafc;
      transition: all 0.2s;
    }
    .form-input:focus, .form-textarea:focus {
      outline: none;
      border-color: #3b82f6;
      background: white;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }
    .form-textarea { min-height: 100px; resize: vertical; }
    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px;
      background: #f8fafc;
      border-top: 1px solid #f1f5f9;
    }

    /* Workflows List Grid */
    .workflows-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 24px;
    }
    .loading, .empty-state {
      grid-column: 1 / -1;
      padding: 60px;
      text-align: center;
      color: #94a3b8;
      font-size: 16px;
    }
    .workflow-card {
      border: 1px solid #f1f5f9;
      border-radius: 12px;
      background: white;
      overflow: hidden;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      flex-direction: column;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .workflow-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 20px -5px rgba(0, 0, 0, 0.1);
      border-color: #e2e8f0;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      background: #fff;
      border-bottom: 1px solid #f8fafc;
    }
    .card-header h4 {
      margin: 0;
      color: #0f172a;
      font-size: 16px;
      font-weight: 600;
    }
    .badge {
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }
    .badge-borrador { background: #fef3c7; color: #92400e; }
    .badge-activo { background: #dcfce7; color: #166534; }
    .badge-inactivo { background: #fee2e2; color: #991b1b; }
    
    .btn-success { background: #10b981; color: white !important; border-color: #059669; }
    .btn-success:hover { background: #059669; }
    .btn-warning { background: #f59e0b; color: white !important; border-color: #d97706; }
    .btn-warning:hover { background: #d97706; }
    
    .card-body {
      padding: 20px;
      flex-grow: 1;
    }
    .card-body p { margin: 0 0 12px; color: #475569; font-size: 14px; }
    .codigo { font-family: 'JetBrains Mono', 'Fira Code', monospace; color: #64748b; font-size: 12px !important; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; display: inline-block; }
    .descripcion { line-height: 1.5; color: #64748b; margin-top: 8px !important; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .meta { color: #94a3b8; font-size: 11px; margin-top: 16px !important; border-top: 1px solid #f8fafc; padding-top: 12px; }
    
    .card-footer {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      padding: 16px 20px;
      background: #f8fafc;
      border-top: 1px solid #f1f5f9;
    }
    .card-footer .btn {
      width: 100%;
    }
  `]
})
export class WorkflowListComponent implements OnInit {
  private readonly workflowService = inject(WorkflowService);
  private readonly router = inject(Router);
  private readonly toastr = inject(ToastrService);

  public workflows = signal<WorkflowListItem[]>([]);
  public isLoading = false;
  public showCreateModal = false;
  public isCreating = false;
  public isActivating: string | null = null;

  public newWorkflow = {
    codigo: '',
    nombre: '',
    descripcion: '',
    estado: 'borrador'
  };

  ngOnInit(): void {
    this.loadWorkflows();
  }

  loadWorkflows(): void {
    this.isLoading = true;
    this.workflowService.listWorkflows().subscribe({
      next: (workflows) => {
        this.workflows.set(workflows);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error cargando workflows:', error);
        this.isLoading = false;
        this.toastr.error('No se pudieron cargar los workflows.', 'Error');
      }
    });
  }

  onCreateWorkflow(): void {
    this.showCreateModal = true;
    this.newWorkflow = {
      codigo: '',
      nombre: '',
      descripcion: '',
      estado: 'borrador'
    };
  }

  submitCreateWorkflow(): void {
    if (!this.newWorkflow.codigo || !this.newWorkflow.nombre) {
      this.toastr.warning('Por favor completa los campos requeridos.', 'Validacion');
      return;
    }

    this.isCreating = true;
    this.workflowService.createWorkflow({
      codigo: this.newWorkflow.codigo,
      nombre: this.newWorkflow.nombre,
      descripcion: this.newWorkflow.descripcion,
      estado: this.newWorkflow.estado
    }).subscribe({
      next: (newWf) => {
        this.isCreating = false;
        this.showCreateModal = false;
        
        // Navegar al editor con el nuevo workflow
        this.router.navigate(['/workflows', newWf.id]);
      },
      error: (error) => {
        this.isCreating = false;
        console.error('Error creando workflow:', error);
        this.toastr.error('No se pudo crear el workflow.', 'Error');
      }
    });
  }

  onEditWorkflow(workflowId: string): void {
    this.router.navigate(['/workflows', workflowId]);
  }

  onManageCollaborators(workflowId: string): void {
    this.router.navigate(['/invitations', workflowId]);
  }

  onDeleteWorkflow(workflowId: string): void {
    if (confirm('¿Estás seguro que deseas eliminar este workflow?')) {
      this.workflowService.deleteWorkflow(workflowId).subscribe({
        next: () => {
          this.loadWorkflows();
        },
        error: (error) => {
          console.error('Error eliminando workflow:', error);
          this.toastr.error('No se pudo eliminar el workflow.', 'Error');
        }
      });
    }
  }

  onActivateWorkflow(wf: WorkflowListItem): void {
    this.isActivating = wf.id;
    
    // 1. Validar primero
    this.workflowService.validateDesign(wf.id).subscribe({
      next: (validation) => {
        if (!validation.valid) {
          this.isActivating = null;
          const errors = validation.errors.join('\n');
          this.toastr.error(errors, 'Errores de Validación', {
            disableTimeOut: true,
            closeButton: true
          });
          return;
        }

        if (validation.warnings && validation.warnings.length > 0) {
          this.toastr.warning(validation.warnings.join('\n'), 'Advertencias de Diseño');
        }

        // 2. Activar si es valido
        this.workflowService.activateWorkflow(wf.id).subscribe({
          next: () => {
            this.isActivating = null;
            this.toastr.success(`Workflow "${wf.nombre}" activado correctamente.`);
            this.loadWorkflows();
          },
          error: (err) => {
            this.isActivating = null;
            console.error('Error activando workflow:', err);
            this.toastr.error('No se pudo activar el workflow.', 'Error');
          }
        });
      },
      error: (err) => {
        this.isActivating = null;
        console.error('Error validando workflow:', err);
        this.toastr.error('No se pudo validar el workflow.', 'Error');
      }
    });
  }

  onDeactivateWorkflow(workflowId: string): void {
    if (confirm('¿Deseas desactivar este workflow? No se podrán crear nuevos trámites.')) {
      this.workflowService.deactivateWorkflow(workflowId).subscribe({
        next: () => {
          this.toastr.info('Workflow desactivado.');
          this.loadWorkflows();
        },
        error: (err) => {
          console.error('Error desactivando workflow:', err);
          this.toastr.error('No se pudo desactivar el workflow.', 'Error');
        }
      });
    }
  }
}
