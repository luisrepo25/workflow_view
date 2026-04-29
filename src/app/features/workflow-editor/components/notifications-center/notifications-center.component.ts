import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../../../core/services/notification.service';
import { WebSocketService } from '../../../../core/services/websocket.service';
import { AuthService } from '../../../../core/services/auth.service';
import { WorkflowChangeMessage } from '../../../../shared/models';

@Component({
  selector: 'app-notifications-center',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="page-header">
        <h1>Notificaciones</h1>
        <p>Centro unificado de alertas y eventos en tiempo real. No leídas: <strong>{{ service.unreadCount() }}</strong></p>
      </header>

      <section class="card actions">
        <button type="button" class="secondary" (click)="reload()">Actualizar</button>
        <button type="button" class="secondary" (click)="markAllRead()">Marcar todas como leídas</button>
        <button type="button" class="danger" (click)="deleteAll()">Eliminar todas</button>
      </section>

      <section class="card">
        @if (service.isLoading()) {
          <p>Cargando notificaciones...</p>
        } @else if (service.notifications().length === 0) {
          <div class="empty-state">No tienes notificaciones.</div>
        } @else {
          <div class="notification-list">
            @for (notification of service.notifications(); track notification.id) {
              <article class="notification-item" [class.unread]="!notification.leida">
                <div class="title-row">
                  <h3>{{ notification.titulo }}</h3>
                  <span class="status" [attr.data-state]="notification.estado">{{ notification.estado }}</span>
                </div>

                <p class="message">{{ notification.mensaje }}</p>
                <p class="meta">{{ notification.createdAt | date:'short' }}</p>

                <div class="row-actions">
                  @if (!notification.leida) {
                    <button type="button" class="secondary" (click)="markRead(notification.id)">Marcar leída</button>
                  }
                  <button type="button" class="danger" (click)="remove(notification.id)">Eliminar</button>
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
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    button { border: none; border-radius: 8px; padding: 8px 12px; cursor: pointer; }
    button.secondary { background: #f1f5f9; color: #0f172a; border: 1px solid #cbd5e1; }
    button.danger { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
    .notification-list { display: grid; gap: 10px; }
    .notification-item { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; background: #fff; }
    .notification-item.unread { border-left: 4px solid #2563eb; background: #f8fbff; }
    .title-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .title-row h3 { margin: 0; font-size: 16px; }
    .status { border-radius: 999px; padding: 2px 8px; font-size: 12px; text-transform: capitalize; background: #e2e8f0; color: #334155; }
    .status[data-state='leida'] { background: #dcfce7; color: #166534; }
    .message { margin: 8px 0 0; color: #1e293b; }
    .meta { margin: 8px 0 0; color: #64748b; font-size: 12px; }
    .row-actions { display: flex; gap: 8px; margin-top: 10px; }
    .empty-state { padding: 24px; border: 1px dashed #cbd5e1; border-radius: 12px; color: #475569; background: #f8fafc; }
  `]
})
export class NotificationsCenterComponent {
  readonly service = inject(NotificationService);
  private readonly websocketService = inject(WebSocketService);
  private readonly authService = inject(AuthService);

  constructor() {
    this.reload();
    this.setupRealtimeNotifications();
  }

  reload(): void {
    this.service.listNotifications().subscribe();
    this.service.getUnreadCount().subscribe();
  }

  markRead(notificationId: string): void {
    this.service.markAsRead(notificationId).subscribe();
  }

  markAllRead(): void {
    this.service.markAllAsRead().subscribe();
  }

  remove(notificationId: string): void {
    this.service.deleteOne(notificationId).subscribe();
  }

  deleteAll(): void {
    this.service.deleteAll().subscribe();
  }

  private setupRealtimeNotifications(): void {
    this.websocketService.connect()
      .then(() => {
        this.websocketService.subscribeToNotificationEvents();

        this.websocketService.notificationEvent$.subscribe(event => {
          if (!event) {
            return;
          }

          if (this.looksLikeWorkflowChange(event)) {
            this.service.pushRealtimeWorkflowEvent(event);
            return;
          }

          this.service.listNotifications().subscribe();
        });
      })
      .catch(() => {
        // El centro sigue operativo aunque no haya canal en tiempo real.
      });
  }

  private looksLikeWorkflowChange(event: unknown): event is WorkflowChangeMessage {
    if (!event || typeof event !== 'object') {
      return false;
    }

    const candidate = event as Partial<WorkflowChangeMessage>;
    return !!candidate.workflowId && !!candidate.action && !!candidate.userId;
  }
}
