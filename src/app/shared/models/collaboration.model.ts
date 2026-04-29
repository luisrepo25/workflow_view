/**
 * Modelo de Colaboración - Invitaciones entre Diseñadores
 */

export type CollaboratorRole = 'DESIGNER' | 'VIEWER';
export type CollaboratorStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'REMOVED';

export interface WorkflowCollaborator {
  id: string;
  workflowId?: string;
  userId: string;
  userName?: string;
  email?: string;
  role: CollaboratorRole;
  status: CollaboratorStatus;
  invitedBy: string;
  invitedByName?: string;
  invitedAt: string;
  acceptedAt?: string | null;
  updatedAt?: string;
}

export interface InviteCollaboratorRequest {
  email: string;
  role: CollaboratorRole;
}

export interface CollaboratorResponse extends WorkflowCollaborator {}
