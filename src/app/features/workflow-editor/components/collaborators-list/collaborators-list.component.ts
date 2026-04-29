import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { WorkflowService } from '../../../../core/services/workflow.service';
import { CollaboratorResponse, CollaboratorRole, InviteCollaboratorRequest, WorkflowListItem } from '../../../../shared/models';

@Component({
  selector: 'app-collaborators-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="page-header">
        <h1>Invitaciones y colaboradores</h1>
        <p>Gestión de accesos para edición de workflows por colaborador.</p>
      </header>

      <section class="card">
        <div class="workflow-selector-row">
          <label for="workflowId">Workflow</label>
          <select id="workflowId" [(ngModel)]="selectedWorkflowId" (ngModelChange)="onWorkflowChange()">
            <option value="">Selecciona un workflow</option>
            @for (workflow of workflows(); track workflow.id) {
              <option [value]="workflow.id">{{ workflow.codigo }} - {{ workflow.nombre }}</option>
            }
          </select>
          <button type="button" class="secondary" (click)="reloadCollaborators()" [disabled]="!selectedWorkflowId || collaboratorsLoading()">
            {{ collaboratorsLoading() ? 'Cargando...' : 'Actualizar' }}
          </button>
        </div>
      </section>

      <section class="card">
        <h2>Invitar colaborador</h2>
        <div class="invite-grid">
          <label>
            Correo electrónico
            <input type="email" [(ngModel)]="inviteEmail" placeholder="colaborador@example.com" />
          </label>

          <label>
            Rol
            <select [(ngModel)]="inviteRole">
              <option value="DESIGNER">DESIGNER</option>
              <option value="VIEWER">VIEWER</option>
            </select>
          </label>

          <button type="button" (click)="invite()" [disabled]="!canInvite() || inviting()">
            {{ inviting() ? 'Enviando...' : 'Enviar invitación' }}
          </button>
          <p class="helper-text">El backend resuelve el usuario por correo y devuelve un error si no existe un registro para ese email.</p>
        </div>
      </section>

      <section class="card">
        <h2>Colaboradores del workflow</h2>

        @if (!selectedWorkflowId) {
          <div class="empty-state">Selecciona un workflow para gestionar colaboradores.</div>
        } @else if (collaboratorsLoading()) {
          <p>Cargando colaboradores...</p>
        } @else if (collaborators().length === 0) {
          <div class="empty-state">No hay colaboradores registrados en este workflow.</div>
        } @else {
          <div class="collaborators-grid">
            @for (collaborator of collaborators(); track collaborator.id) {
              <article class="collaborator-card">
                <div class="card-head">
                  <strong>{{ collaborator.userName || collaborator.email || collaborator.userId }}</strong>
                  <span class="status" [attr.data-status]="collaborator.status">{{ collaborator.status }}</span>
                </div>

                <p class="meta">User ID: {{ collaborator.userId }}</p>
                <p class="meta">Invitado por: {{ collaborator.invitedByName || collaborator.invitedBy }}</p>
                <p class="meta">Invitado: {{ collaborator.invitedAt | date:'short' }}</p>

                <div class="role-row">
                  <label>
                    Rol
                    <select [ngModel]="collaborator.role" (ngModelChange)="changeRole(collaborator, $event)">
                      <option value="DESIGNER">DESIGNER</option>
                      <option value="VIEWER">VIEWER</option>
                    </select>
                  </label>
                </div>

                <div class="actions">
                  <button type="button" class="danger" (click)="remove(collaborator)">Eliminar colaborador</button>
                </div>
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
    .workflow-selector-row { display: grid; grid-template-columns: 120px 1fr auto; gap: 10px; align-items: center; }
    .invite-grid { display: grid; grid-template-columns: minmax(220px, 1fr) 180px auto; gap: 12px; align-items: end; }
    .invite-grid label, .role-row label { display: grid; gap: 6px; color: #334155; font-size: 13px; }
    .helper-text { grid-column: 1 / -1; margin: 0; color: #64748b; font-size: 13px; }
    input, select { width: 100%; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px; box-sizing: border-box; }
    button { border: none; border-radius: 8px; background: #0f172a; color: #fff; padding: 8px 12px; cursor: pointer; }
    button.secondary { background: #f1f5f9; color: #0f172a; border: 1px solid #cbd5e1; }
    button.danger { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
    button:disabled { opacity: .6; cursor: not-allowed; }
    .collaborators-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
    .collaborator-card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; background: #f8fafc; display: grid; gap: 8px; }
    .card-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .status { border-radius: 999px; padding: 2px 8px; font-size: 12px; text-transform: uppercase; background: #e2e8f0; color: #334155; }
    .status[data-status='PENDING'] { background: #fef3c7; color: #92400e; }
    .status[data-status='ACCEPTED'] { background: #dcfce7; color: #166534; }
    .status[data-status='REJECTED'] { background: #fee2e2; color: #991b1b; }
    .meta { margin: 0; color: #64748b; font-size: 13px; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px; }
    .empty-state { padding: 24px; border: 1px dashed #cbd5e1; border-radius: 12px; color: #475569; background: #f8fafc; }
    @media (max-width: 900px) {
      .workflow-selector-row, .invite-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class CollaboratorsListComponent implements OnInit {
  private readonly workflowService = inject(WorkflowService);
  private readonly route = inject(ActivatedRoute);
  private readonly toastr = inject(ToastrService);

  readonly workflows = signal<WorkflowListItem[]>([]);
  readonly collaborators = signal<CollaboratorResponse[]>([]);

  readonly workflowsLoading = signal(false);
  readonly collaboratorsLoading = signal(false);
  readonly inviting = signal(false);

  selectedWorkflowId = '';
  inviteEmail = '';
  inviteRole: CollaboratorRole = 'DESIGNER';

  canInvite(): boolean {
    return !!this.selectedWorkflowId && !!this.inviteEmail.trim();
  }

  ngOnInit(): void {
    this.loadWorkflows();

    const routeWorkflowId = this.route.snapshot.paramMap.get('workflowId');
    const queryWorkflowId = this.route.snapshot.queryParamMap.get('workflowId');
    const initialWorkflowId = routeWorkflowId || queryWorkflowId || '';

    if (initialWorkflowId) {
      this.selectedWorkflowId = initialWorkflowId;
      this.reloadCollaborators();
    }
  }

  onWorkflowChange(): void {
    if (!this.selectedWorkflowId) {
      this.collaborators.set([]);
      return;
    }

    this.reloadCollaborators();
  }

  invite(): void {
    if (!this.canInvite()) {
      return;
    }

    const payload: InviteCollaboratorRequest = {
      email: this.inviteEmail.trim(),
      role: this.inviteRole
    };

    this.inviting.set(true);
    this.workflowService.inviteCollaborator(this.selectedWorkflowId, payload).subscribe({
      next: () => {
        this.inviting.set(false);
        this.inviteEmail = '';
        this.toastr.success('Invitación enviada correctamente.', 'Colaboradores');
        this.reloadCollaborators();
      },
      error: (error) => {
        this.inviting.set(false);
        const message = error?.error?.message || 'No se pudo enviar la invitación.';
        this.toastr.error(message, 'Colaboradores');
      }
    });
  }

  reloadCollaborators(): void {
    if (!this.selectedWorkflowId) {
      return;
    }

    this.collaboratorsLoading.set(true);
    this.workflowService.listCollaborators(this.selectedWorkflowId).subscribe({
      next: (items) => {
        this.collaboratorsLoading.set(false);
        this.collaborators.set(items);
      },
      error: (error) => {
        this.collaboratorsLoading.set(false);
        const message = error?.error?.message || 'No se pudo cargar la lista de colaboradores.';
        this.toastr.error(message, 'Colaboradores');
      }
    });
  }

  remove(collaborator: CollaboratorResponse): void {
    this.workflowService.removeCollaborator(this.selectedWorkflowId, collaborator.userId).subscribe({
      next: () => {
        this.toastr.success('Colaborador eliminado.', 'Colaboradores');
        this.reloadCollaborators();
      },
      error: (error) => {
        const message = error?.error?.message || 'No se pudo eliminar el colaborador.';
        this.toastr.error(message, 'Colaboradores');
      }
    });
  }

  changeRole(collaborator: CollaboratorResponse, role: CollaboratorRole): void {
    if (role === collaborator.role) {
      return;
    }

    this.workflowService.changeCollaboratorRole(this.selectedWorkflowId, collaborator.userId, role).subscribe({
      next: () => {
        this.toastr.success('Rol actualizado.', 'Colaboradores');
        this.collaborators.update(items => items.map(item => item.id === collaborator.id ? { ...item, role } : item));
      },
      error: (error) => {
        const message = error?.error?.message || 'No se pudo cambiar el rol.';
        this.toastr.error(message, 'Colaboradores');
        this.reloadCollaborators();
      }
    });
  }

  private loadWorkflows(): void {
    this.workflowsLoading.set(true);

    this.workflowService.listWorkflows().subscribe({
      next: (items) => {
        this.workflowsLoading.set(false);
        this.workflows.set(items);
      },
      error: () => {
        this.workflowsLoading.set(false);
        this.workflows.set([]);
      }
    });
  }
}
