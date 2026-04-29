import { Injectable, signal, computed, NgZone, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Client, Frame, IMessage, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { WorkflowChangeMessage } from '../../shared/models';
import { environment } from '../config/environment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private stompClient: Client | null = null;
  private ngZone = inject(NgZone);
  private authService = inject(AuthService);
  private connectPromise: Promise<boolean> | null = null;
  private lastTransportUsed: 'native' | 'sockjs' | null = null;

  // Signals
  private connectedSignal = signal(false);
  connected = computed(() => this.connectedSignal());

  private workflowChangesSignal = signal<WorkflowChangeMessage[]>([]);
  workflowChanges = computed(() => this.workflowChangesSignal());

  private activeEditorsSignal = signal<Map<string, any>>(new Map());
  activeEditors = computed(() => Array.from(this.activeEditorsSignal().values()));

  private currentWorkflowIdSignal = signal<string | null>(null);
  currentWorkflowId = computed(() => this.currentWorkflowIdSignal());

  // Observables para eventos
  private workflowChangeSubject = new BehaviorSubject<WorkflowChangeMessage | null>(null);
  workflowChange$ = this.workflowChangeSubject.asObservable();

  private editorChangeSubject = new BehaviorSubject<any>(null);
  editorChange$ = this.editorChangeSubject.asObservable();

  private notificationEventSubject = new BehaviorSubject<any>(null);
  notificationEvent$ = this.notificationEventSubject.asObservable();
  private notificationSubscriptions: StompSubscription[] = [];

  /**
   * Conectar a WebSocket del servidor
   */
  connect(baseUrl?: string): Promise<boolean> {
    if (this.connectedSignal()) {
      return Promise.resolve(true);
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = this.connectWithFallback(baseUrl)
      .finally(() => {
        this.connectPromise = null;
      });

    return this.connectPromise;
  }

  private async connectWithFallback(baseUrl?: string): Promise<boolean> {
    const nativeWsUrl = baseUrl
      ? baseUrl.replace(/\/+$/, '').replace(/^http/, 'ws') + '/ws/workflow'
      : environment.websocketUrl;

    const sockJsUrl = baseUrl
      ? baseUrl.replace(/\/+$/, '').replace(/^ws/, 'http') + '/ws/workflow'
      : environment.websocketSockJsUrl;

    try {
      await this.connectWithTransport('native', nativeWsUrl);
      return true;
    } catch {
      await this.connectWithTransport('sockjs', sockJsUrl);
      return true;
    }
  }

  private connectWithTransport(transport: 'native' | 'sockjs', endpoint: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      let hasConnectedOnce = false;

      const settleResolve = () => {
        if (settled) return;
        settled = true;
        resolve();
      };

      const settleReject = (error: unknown) => {
        if (settled) return;
        settled = true;
        reject(error);
      };

      if (this.stompClient?.active) {
        this.stompClient.deactivate();
      }

      const client = new Client({
        ...(transport === 'native'
          ? { brokerURL: endpoint }
          : { webSocketFactory: () => new SockJS(endpoint) }),
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
        connectionTimeout: 10000
      });
        const token = this.authService.getToken();
        if (token) {
          client.connectHeaders = {
            'Authorization': `Bearer ${token}`
          };
        }

      this.stompClient = client;
      this.lastTransportUsed = transport;

      client.onConnect = () => {
        this.ngZone.run(() => {
          hasConnectedOnce = true;
          this.connectedSignal.set(true);
          console.log(`✅ WebSocket conectado (${transport})`);
          settleResolve();
        });
      };

      client.onStompError = (frame: Frame) => {
        this.ngZone.run(() => {
          this.connectedSignal.set(false);
          settleReject(frame.headers['message'] || frame.body || frame);
        });
      };

      client.onWebSocketError = (event: Event) => {
        this.ngZone.run(() => {
          this.connectedSignal.set(false);
          if (!hasConnectedOnce) {
            client.deactivate();
            settleReject(event);
          }
        });
      };

      client.onWebSocketClose = () => {
        this.ngZone.run(() => {
          this.connectedSignal.set(false);
          if (!hasConnectedOnce) {
            client.deactivate();
            settleReject(new Error(`No se pudo conectar por ${transport}.`));
          }
        });
      };

      client.activate();
    });
  }

  /**
   * Desconectar del WebSocket
   */
  disconnect(): void {
    if (this.stompClient?.active) {
      this.unsubscribeNotificationEvents();
      this.stompClient.deactivate();
      this.ngZone.run(() => {
        this.connectedSignal.set(false);
        this.currentWorkflowIdSignal.set(null);
        console.log('✅ WebSocket desconectado');
      });
    }
  }

  /**
   * Conectarse a un workflow específico
   */
  connectToWorkflow(workflowId: string, userId: string, userName: string): void {
    if (!this.stompClient?.active) {
      console.error('No conectado a WebSocket');
      return;
    }

    this.currentWorkflowIdSignal.set(workflowId);

    // Enviar mensaje de conexión
    this.stompClient.publish({
      destination: `/app/workflow/${workflowId}/connect`,
      body: JSON.stringify({ userId, userName, action: 'connect' })
    });

    // Suscribirse a cambios
    this.stompClient.subscribe(`/topic/workflow/${workflowId}`, (message: IMessage) => {
      const change: WorkflowChangeMessage = JSON.parse(message.body);
      this.ngZone.run(() => {
        this.workflowChangeSubject.next(change);
        this.workflowChangesSignal.update(changes => [...changes, change].slice(-100)); // Mantener últimos 100

        // Actualizar lista de editores
        if (change.action === 'user_connected') {
          const editors = this.activeEditorsSignal();
          editors.set(change.userId, { userId: change.userId, userName: change.userName });
          this.activeEditorsSignal.set(new Map(editors));
          this.editorChangeSubject.next(change);
        } else if (change.action === 'user_disconnected') {
          const editors = this.activeEditorsSignal();
          editors.delete(change.userId);
          this.activeEditorsSignal.set(new Map(editors));
          this.editorChangeSubject.next(change);
        }
      });
    });

    // Suscribirse a selecciones
    this.stompClient.subscribe(`/topic/workflow/${workflowId}/selections`, (message: IMessage) => {
      const selection = JSON.parse(message.body);
      this.ngZone.run(() => {
        this.editorChangeSubject.next(selection);
      });
    });
  }

  subscribeToNotificationEvents(): void {
    if (!this.stompClient?.active || this.notificationSubscriptions.length > 0) {
      return;
    }

    const userQueueSubscription = this.stompClient.subscribe('/user/queue/notifications', (message: IMessage) => {
      this.emitNotificationEvent(message.body);
    });

    const topicSubscription = this.stompClient.subscribe('/topic/notifications', (message: IMessage) => {
      this.emitNotificationEvent(message.body);
    });

    this.notificationSubscriptions = [userQueueSubscription, topicSubscription];
  }

  unsubscribeNotificationEvents(): void {
    this.notificationSubscriptions.forEach(subscription => subscription.unsubscribe());
    this.notificationSubscriptions = [];
  }

  private emitNotificationEvent(rawBody: string): void {
    let parsed: any;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      parsed = { message: rawBody, timestamp: Date.now() };
    }

    this.ngZone.run(() => this.notificationEventSubject.next(parsed));
  }

  /**
   * Desconectarse de un workflow
   */
  disconnectFromWorkflow(workflowId: string, userId: string, userName: string): void {
    if (!this.stompClient?.active) return;

    this.stompClient.publish({destination: `/app/workflow/${workflowId}/disconnect`, body: JSON.stringify({ userId, userName, action: 'disconnect' })});

    this.currentWorkflowIdSignal.set(null);
  }

  private generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  /**
   * Agregar nodo
   */
  addNode(workflowId: string, node: any, userId: string, userName: string): void {
    if (!this.stompClient?.active) return;

    this.stompClient.publish({destination: `/app/workflow/${workflowId}/node/add`, body: JSON.stringify({ userId, userName, action: 'node_added', nodeId: node?.id, messageId: this.generateMessageId(), data: node })});
  }

  /**
   * Actualizar nodo
   */
  updateNode(workflowId: string, node: any, userId: string, userName: string): void {
    if (!this.stompClient?.active) return;

    this.stompClient.publish({destination: `/app/workflow/${workflowId}/node/update`, body: JSON.stringify({ userId, userName, action: 'node_updated', nodeId: node?.id, messageId: this.generateMessageId(), data: node })});
  }

  /**
   * Eliminar nodo
   */
  deleteNode(workflowId: string, nodeId: string, userId: string, userName: string): void {
    if (!this.stompClient?.active) return;

    this.stompClient.publish({destination: `/app/workflow/${workflowId}/node/delete`, body: JSON.stringify({ userId, userName, action: 'node_deleted', nodeId, messageId: this.generateMessageId() })});
  }

  /**
   * Agregar arista
   */
  addEdge(workflowId: string, edge: any, userId: string, userName: string): void {
    if (!this.stompClient?.active) return;

    this.stompClient.publish({destination: `/app/workflow/${workflowId}/edge/add`, body: JSON.stringify({ userId, userName, action: 'edge_added', edgeId: edge?.id, messageId: this.generateMessageId(), data: edge })});
  }

  /**
   * Eliminar arista
   */
  deleteEdge(workflowId: string, edge: { id?: string; fromNodeId: string; toNodeId: string }, userId: string, userName: string): void {
    if (!this.stompClient?.active) return;

    this.stompClient.publish({
      destination: `/app/workflow/${workflowId}/edge/delete`,
      body: JSON.stringify({
        userId,
        userName,
        action: 'edge_deleted',
        edgeId: edge.id,
        messageId: this.generateMessageId(),
        data: {
          fromNodeId: edge.fromNodeId,
          toNodeId: edge.toNodeId
        }
      })
    });
  }

  /**
   * Agregar lane
   */
  addLane(workflowId: string, lane: any, userId: string, userName: string): void {
    if (!this.stompClient?.active) return;

    this.stompClient.publish({destination: `/app/workflow/${workflowId}/lane/add`, body: JSON.stringify({ userId, userName, action: 'lane_added', messageId: this.generateMessageId(), data: lane })});
  }

  /**
   * Actualizar lane
   */
  updateLane(workflowId: string, lane: any, userId: string, userName: string): void {
    if (!this.stompClient?.active) return;

    this.stompClient.publish({destination: `/app/workflow/${workflowId}/lane/update`, body: JSON.stringify({ userId, userName, action: 'lane_updated', messageId: this.generateMessageId(), data: lane })});
  }

  /**
   * Eliminar lane
   */
  deleteLane(workflowId: string, laneId: string, userId: string, userName: string): void {
    if (!this.stompClient?.active) return;

    this.stompClient.publish({destination: `/app/workflow/${workflowId}/lane/delete`, body: JSON.stringify({ userId, userName, action: 'lane_deleted', laneId, messageId: this.generateMessageId() })});
  }

  /**
   * Actualizar selección/cursor
   */
  updateSelection(workflowId: string, selectedElement: string | null, userId: string, userName: string): void {
    if (!this.stompClient?.active) return;

    this.stompClient.publish({destination: `/app/workflow/${workflowId}/selection`, body: JSON.stringify({ userId, userName, selectedElement, timestamp: Date.now() })});
  }

  /**
   * Obtener estado de edición actual
   */
  getEditingState(workflowId: string, userId: string): void {
    if (!this.stompClient?.active) return;

    this.stompClient.publish({destination: `/app/workflow/${workflowId}/state`, body: JSON.stringify({ userId, action: 'get_state' })});
  }

  /**
   * Obtener historial de cambios
   */
  getChangeHistory(workflowId: string, userId: string): void {
    if (!this.stompClient?.active) return;

    this.stompClient.publish({destination: `/app/workflow/${workflowId}/history`, body: JSON.stringify({ userId, action: 'get_history' })});
  }

  /**
   * Verificar si está conectado
   */
  isConnected(): boolean {
    return this.connectedSignal();
  }

  /**
   * Obtener workflowId actual
   */
  getCurrentWorkflowId(): string | null {
    return this.currentWorkflowIdSignal();
  }
}
