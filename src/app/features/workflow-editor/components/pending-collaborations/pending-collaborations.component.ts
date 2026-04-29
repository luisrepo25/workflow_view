import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { WorkflowService } from '../../../../core/services/workflow.service';
import { CollaboratorResponse } from '../../../../shared/models';

@Component({
  selector: 'app-pending-collaborations',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <h1>Invitaciones pendientes</h1>
          <p>Revisa las colaboraciones pendientes de tu cuenta y decide si aceptarlas o rechazarlas.</p>
        </div>
        <a routerLink="/workflows" class="secondary-link">Volver a workflows</a>
      </header>

      <section class="card">
        @if (loading()) {
          <p>Cargando invitaciones...</p>
        } @else if (pendingCollaborations().length === 0) {
          <div class="empty-state">No tienes invitaciones pendientes.</div>
        } @else {
          <div class="invitation-grid">
            @for (invitation of pendingCollaborations(); track invitation.id) {
              <article class="invitation-card">
                <div class="card-head">
                  <strong>{{ invitation.workflowId }}</strong>
                  <span class="status" [attr.data-status]="invitation.status">{{ invitation.status }}</span>
                </div>

                <p class="meta">Rol invitado: {{ invitation.role }}</p>
                <p class="meta">Invitado por: {{ invitation.invitedByName || invitation.invitedBy }}</p>
                <p class="meta">Fecha: {{ invitation.invitedAt | date:'short' }}</p>

                <div class="actions">
                  <button type="button" class="primary" (click)="accept(invitation)" [disabled]="processingId() === invitation.id">
                    Aceptar
                  </button>
                  <button type="button" class="danger" (click)="reject(invitation)" [disabled]="processingId() === invitation.id">
                    Rechazar
                  </button>
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
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
    .page-header h1 { margin: 0 0 8px; }
    .page-header p { margin: 0; color: #64748b; }
    .secondary-link { align-self: center; padding: 8px 12px; border-radius: 8px; background: #f1f5f9; color: #0f172a; text-decoration: none; border: 1px solid #cbd5e1; }
    .card { border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; padding: 16px; }
    .invitation-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
    .invitation-card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; background: #f8fafc; display: grid; gap: 8px; }
    .card-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .status { border-radius: 999px; padding: 2px 8px; font-size: 12px; text-transform: uppercase; background: #e2e8f0; color: #334155; }
    .meta { margin: 0; color: #64748b; font-size: 13px; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px; }
    button { border: none; border-radius: 8px; padding: 8px 12px; cursor: pointer; }
    button.primary { background: #0f172a; color: #fff; }
    button.danger { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
    button:disabled { opacity: .6; cursor: not-allowed; }
    .empty-state { padding: 24px; border: 1px dashed #cbd5e1; border-radius: 12px; color: #475569; background: #f8fafc; }
    @media (max-width: 768px) {
      .page-header { flex-direction: column; }
      .secondary-link { align-self: flex-start; }
    }
  `]
})
export class PendingCollaborationsComponent implements OnInit {
  private readonly workflowService = inject(WorkflowService);
  private readonly toastr = inject(ToastrService);

  readonly pendingCollaborations = signal<CollaboratorResponse[]>([]);
  readonly loading = signal(false);
  readonly processingId = signal<string | null>(null);

  ngOnInit(): void {
    this.loadPendingCollaborations();
  }

  loadPendingCollaborations(): void {
    this.loading.set(true);
    this.workflowService.listPendingCollaborations().subscribe({
      next: (items) => {
        this.pendingCollaborations.set(items);
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        const message = error?.error?.message || 'No se pudieron cargar las invitaciones pendientes.';
        this.toastr.error(message, 'Invitaciones pendientes');
      }
    });
  }

  accept(invitation: CollaboratorResponse): void {
    if (!invitation.id || !invitation.workflowId) {
      this.toastr.error('La invitación no incluye el workflow asociado.', 'Invitaciones pendientes');
      return;
    }

    this.processingId.set(invitation.id);
    this.workflowService.acceptInvitation(invitation.workflowId, invitation.id).subscribe({
      next: () => {
        this.processingId.set(null);
        this.toastr.success('Invitación aceptada.', 'Invitaciones pendientes');
        this.loadPendingCollaborations();
      },
      error: (error) => {
        this.processingId.set(null);
        const message = error?.error?.message || 'No se pudo aceptar la invitación.';
        this.toastr.error(message, 'Invitaciones pendientes');
      }
    });
  }

  reject(invitation: CollaboratorResponse): void {
    if (!invitation.workflowId) {
      this.toastr.error('La invitación no incluye el workflow asociado.', 'Invitaciones pendientes');
      return;
    }

    this.processingId.set(invitation.id);
    this.workflowService.rejectInvitation(invitation.workflowId, invitation.id).subscribe({
      next: () => {
        this.processingId.set(null);
        this.toastr.success('Invitación rechazada.', 'Invitaciones pendientes');
        this.loadPendingCollaborations();
      },
      error: (error) => {
        this.processingId.set(null);
        const message = error?.error?.message || 'No se pudo rechazar la invitación.';
        this.toastr.error(message, 'Invitaciones pendientes');
      }
    });
  }
}