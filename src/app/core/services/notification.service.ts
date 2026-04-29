import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';
import { Notification, NotificationResponse, UnreadCountResponse, WorkflowChangeMessage } from '../../shared/models';
import { environment } from '../config/environment';

interface MutationResponse {
  status: string;
  message: string;
  count?: number;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.notificationsUrl;

  private readonly notificationsSignal = signal<Notification[]>([]);
  notifications = computed(() => this.notificationsSignal());

  private readonly unreadCountSignal = signal(0);
  unreadCount = computed(() => this.unreadCountSignal());

  private readonly loadingSignal = signal(false);
  isLoading = computed(() => this.loadingSignal());

  private readonly errorSignal = signal<string | null>(null);
  error = computed(() => this.errorSignal());

  listNotifications() {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.http.get<NotificationResponse[]>(this.apiUrl).pipe(
      tap({
        next: (items) => {
          this.notificationsSignal.set(items);
          this.unreadCountSignal.set(items.filter(item => !item.leida).length);
          this.loadingSignal.set(false);
        },
        error: () => {
          this.errorSignal.set('No se pudieron cargar las notificaciones.');
          this.loadingSignal.set(false);
        }
      })
    );
  }

  listUnread() {
    return this.http.get<NotificationResponse[]>(`${this.apiUrl}/unread`).pipe(
      tap((items) => {
        const current = this.notificationsSignal();
        const knownIds = new Set(current.map(item => item.id));
        const merged = [...items, ...current.filter(item => !knownIds.has(item.id))];
        this.notificationsSignal.set(merged);
        this.unreadCountSignal.set(items.length);
      })
    );
  }

  getUnreadCount() {
    return this.http.get<UnreadCountResponse>(`${this.apiUrl}/unread-count`).pipe(
      tap(response => this.unreadCountSignal.set(response.unreadCount))
    );
  }

  markAsRead(notificationId: string) {
    return this.http.put<MutationResponse>(`${this.apiUrl}/${notificationId}/read`, {}).pipe(
      tap(() => {
        this.notificationsSignal.update(items =>
          items.map(item =>
            item.id === notificationId
              ? { ...item, leida: true, estado: 'leida', leIdoAt: new Date().toISOString() }
              : item
          )
        );
        this.unreadCountSignal.update(count => Math.max(0, count - 1));
      })
    );
  }

  markAllAsRead() {
    return this.http.put<MutationResponse>(`${this.apiUrl}/read-all`, {}).pipe(
      tap(() => {
        this.notificationsSignal.update(items =>
          items.map(item => ({ ...item, leida: true, estado: 'leida' }))
        );
        this.unreadCountSignal.set(0);
      })
    );
  }

  deleteOne(notificationId: string) {
    return this.http.delete<MutationResponse>(`${this.apiUrl}/${notificationId}`).pipe(
      tap(() => {
        const current = this.notificationsSignal();
        const target = current.find(item => item.id === notificationId);
        this.notificationsSignal.set(current.filter(item => item.id !== notificationId));
        if (target && !target.leida) {
          this.unreadCountSignal.update(count => Math.max(0, count - 1));
        }
      })
    );
  }

  deleteAll() {
    return this.http.delete<MutationResponse>(this.apiUrl).pipe(
      tap(() => {
        this.notificationsSignal.set([]);
        this.unreadCountSignal.set(0);
      })
    );
  }

  pushRealtimeWorkflowEvent(change: WorkflowChangeMessage) {
    const eventAsNotification: Notification = {
      id: `rt-${change.messageId ?? change.timestamp}`,
      userId: change.userId,
      tipo: 'in_app',
      titulo: 'Evento en tiempo real',
      mensaje: change.message ?? `${change.userName} ejecutó ${change.action}`,
      estado: 'pendiente_envio',
      referencia: {
        workflowId: change.workflowId,
        nodeId: change.nodeId
      },
      leida: false,
      createdAt: new Date(change.timestamp || Date.now()).toISOString(),
      updatedAt: new Date(change.timestamp || Date.now()).toISOString()
    };

    this.notificationsSignal.update(items => {
      if (items.some(item => item.id === eventAsNotification.id)) {
        return items;
      }
      return [eventAsNotification, ...items].slice(0, 100);
    });

    this.unreadCountSignal.update(count => count + 1);
  }
}
