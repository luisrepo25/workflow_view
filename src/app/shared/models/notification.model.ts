/**
 * Modelo de Notificaciones
 */

export type NotificationType = 'push' | 'in_app' | 'push_in_app';
export type NotificationStatus = 'pendiente_envio' | 'enviada' | 'fallida' | 'leida';

export interface NotificationReference {
  processInstanceId?: string;
  workflowId?: string;
  collaboratorId?: string;
  nodeId?: string;
}

export interface Notification {
  id: string;
  userId: string;
  tipo: NotificationType;
  titulo: string;
  mensaje: string;
  estado: NotificationStatus;
  referencia?: NotificationReference;
  leida: boolean;
  createdAt: string;
  updatedAt: string;
  leIdoAt?: string;
  enviadoAt?: string;
  canal?: string;
  motivoFalla?: string;
  intentosReenvio?: number;
  ipAddress?: string;
  userAgent?: string;
}

export interface PushMeta {
  tokens: string[];
  enviado: boolean;
  fechaEnvio: string;
  error?: string;
}

export interface NotificationResponse extends Notification {}

export interface UnreadCountResponse {
  unreadCount: number;
}
