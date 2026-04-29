import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  DecisionContextResponse,
  DecisionRulesPatchRequest,
  DecisionRulesPatchResponse,
  DecisionRulesSimulateRequest,
  DecisionRulesSimulateResponse,
  DecisionRulesValidateRequest,
  DecisionRulesValidationResult,
  Workflow,
  WorkflowListItem,
  WorkflowValidationResponse
} from '../../shared/models';
import { CollaboratorResponse, CollaboratorRole, InviteCollaboratorRequest } from '../../shared/models';
import { tap } from 'rxjs';
import { environment } from '../config/environment';

export interface UserListItem {
  id: string;
  nombre: string;
  email: string;
  departmentId?: string;
  rol?: string;
}

@Injectable({
  providedIn: 'root'
})
export class WorkflowService {
  private apiUrl = environment.workflowsUrl;
  private http = inject(HttpClient);

  // Signals para estado
  private workflowsSignal = signal<WorkflowListItem[]>([]);
  workflows = computed(() => this.workflowsSignal());

  private currentWorkflowSignal = signal<Workflow | null>(null);
  currentWorkflow = computed(() => this.currentWorkflowSignal());

  private loadingSignal = signal(false);
  isLoading = computed(() => this.loadingSignal());

  private errorSignal = signal<string | null>(null);
  error = computed(() => this.errorSignal());

  /**
   * Obtener lista de workflows
   */
  listWorkflows(filters?: { estado?: string; nombre?: string }) {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    let params = new HttpParams();
    if (filters?.estado) params = params.set('estado', filters.estado);
    if (filters?.nombre) params = params.set('nombre', filters.nombre);

    return this.http.get<WorkflowListItem[]>(this.apiUrl, { params }).pipe(
      tap(data => {
        this.workflowsSignal.set(data);
        this.loadingSignal.set(false);
      })
    );
  }

  /**
   * Obtener workflows activos para crear tramites (perfil funcionario)
   */
  listActiveWorkflowsForProcesses() {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.http.get<WorkflowListItem[]>(`${this.apiUrl}/active-for-processes`).pipe(
      tap(data => {
        this.workflowsSignal.set(data);
        this.loadingSignal.set(false);
      })
    );
  }

  /**
   * Obtener usuarios con filtros opcionales (ej: clientes activos)
   */
  listUsers(filters?: { role?: 'Cliente' | 'Funcionario' | 'Diseñador' | 'Administrador'; activo?: boolean }) {
    let params = new HttpParams();

    if (filters?.role) {
      params = params.set('role', filters.role);
    }

    if (filters?.activo !== undefined) {
      params = params.set('activo', String(filters.activo));
    }

    return this.http.get<UserListItem[]>(`${environment.apiUrl}/users`, { params });
  }

  /**
   * Obtener workflow por ID
   */
  getWorkflow(workflowId: string) {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.http.get<Workflow>(`${this.apiUrl}/${workflowId}`).pipe(
      tap(workflow => {
        this.currentWorkflowSignal.set(workflow);
        this.loadingSignal.set(false);
      })
    );
  }

  /**
   * Crear nuevo workflow
   */
  createWorkflow(data: { codigo: string; nombre: string; descripcion?: string; estado?: string }) {
    return this.http.post<Workflow>(this.apiUrl, data).pipe(
      tap(workflow => {
        this.workflowsSignal.update(workflows => [...workflows, {
          id: workflow.id,
          codigo: workflow.codigo,
          nombre: workflow.nombre,
          descripcion: workflow.descripcion,
          estado: workflow.estado,
          createdAt: workflow.createdAt,
          updatedAt: workflow.updatedAt,
          createdBy: workflow.createdBy,
          enEdicionPor: workflow.enEdicionPor
        }]);
      })
    );
  }

  /**
   * Actualizar metadatos del workflow
   */
  updateMetadata(workflowId: string, data: { nombre?: string; descripcion?: string; estado?: string }) {
    return this.http.patch<Workflow>(`${this.apiUrl}/${workflowId}`, data).pipe(
      tap(workflow => {
        this.currentWorkflowSignal.set(workflow);
      })
    );
  }

  /**
   * Guardar diseño del workflow
   */
  saveDesign(workflowId: string, design: any) {
    return this.http.put<Workflow>(`${this.apiUrl}/${workflowId}/design`, design).pipe(
      tap(workflow => {
        this.currentWorkflowSignal.set(workflow);
      })
    );
  }

  /**
   * Validar diseño del workflow
   */
  validateDesign(workflowId: string) {
    return this.http.post<WorkflowValidationResponse>(
      `${this.apiUrl}/${workflowId}/validate`,
      {}
    );
  }

  /**
   * Obtener contexto para constructor de reglas de decision
   */
  getDecisionContext(workflowId: string, decisionNodeId: string) {
    return this.http.get<DecisionContextResponse>(
      `${this.apiUrl}/${workflowId}/decision-context/${decisionNodeId}`
    );
  }

  /**
   * Persistir reglas de decision para un nodo decision
   */
  patchDecisionRules(workflowId: string, decisionNodeId: string, payload: DecisionRulesPatchRequest) {
    return this.http.patch<DecisionRulesPatchResponse>(
      `${this.apiUrl}/${workflowId}/nodes/${decisionNodeId}/decision-rules`,
      payload
    );
  }

  /**
   * Validar reglas de decision sin persistir
   */
  validateDecisionRules(workflowId: string, decisionNodeId: string, payload: DecisionRulesValidateRequest) {
    return this.http.post<DecisionRulesValidationResult>(
      `${this.apiUrl}/${workflowId}/nodes/${decisionNodeId}/decision-rules/validate`,
      payload
    );
  }

  /**
   * Simular evaluacion de reglas de decision
   */
  simulateDecisionRules(workflowId: string, decisionNodeId: string, payload: DecisionRulesSimulateRequest) {
    return this.http.post<DecisionRulesSimulateResponse>(
      `${this.apiUrl}/${workflowId}/nodes/${decisionNodeId}/decision-rules/simulate`,
      payload
    );
  }

  /**
   * Activar workflow
   */
  activateWorkflow(workflowId: string) {
    return this.http.post(`${this.apiUrl}/${workflowId}/activate`, {}).pipe(
      tap(workflow => {
        this.currentWorkflowSignal.set(workflow as Workflow);
      })
    );
  }

  /**
   * Desactivar workflow
   */
  deactivateWorkflow(workflowId: string) {
    return this.http.post<Workflow>(`${this.apiUrl}/${workflowId}/deactivate`, {}).pipe(
      tap(workflow => {
        this.currentWorkflowSignal.set(workflow);
      })
    );
  }

  /**
   * Bloquear workflow para editar
   */
  lockWorkflow(workflowId: string, userId: string) {
    return this.http.post(`${this.apiUrl}/${workflowId}/lock`, { userId });
  }

  /**
   * Obtener estado del lock del workflow
   */
  getLockStatus(workflowId: string) {
    return this.http.get(`${this.apiUrl}/${workflowId}/lock`);
  }

  /**
   * Desbloquear workflow
   */
  unlockWorkflow(workflowId: string, userId: string) {
    return this.http.delete(`${this.apiUrl}/${workflowId}/lock`, {
      params: new HttpParams().set('userId', userId)
    });
  }

  /**
   * Eliminar workflow
   */
  deleteWorkflow(workflowId: string) {
    return this.http.delete(`${this.apiUrl}/${workflowId}`).pipe(
      tap(() => {
        this.workflowsSignal.update(workflows =>
          workflows.filter(w => w.id !== workflowId)
        );
      })
    );
  }

  /**
   * Obtener historial de cambios
   */
  getHistory(workflowId: string, limit: number = 1000) {
    return this.http.get(`${this.apiUrl}/${workflowId}/history`, {
      params: new HttpParams().set('limit', limit.toString())
    });
  }

  /**
   * Invitar colaborador a un workflow
   */
  inviteCollaborator(workflowId: string, payload: InviteCollaboratorRequest) {
    return this.http.post<CollaboratorResponse>(`${this.apiUrl}/${workflowId}/collaborators`, payload);
  }

  /**
   * Listar colaboradores del workflow
   */
  listCollaborators(workflowId: string) {
    return this.http.get<CollaboratorResponse[]>(`${this.apiUrl}/${workflowId}/collaborators`);
  }

  /**
   * Listar invitaciones pendientes del usuario autenticado
   */
  listPendingCollaborations() {
    return this.http.get<CollaboratorResponse[]>(`${environment.apiUrl}/collaborations/pending`);
  }

  /**
   * Aceptar invitacion de colaboracion
   */
  acceptInvitation(workflowId: string, collaboratorId: string) {
    return this.http.post<CollaboratorResponse>(`${this.apiUrl}/${workflowId}/collaborators/${collaboratorId}/accept`, {});
  }

  /**
   * Rechazar invitacion de colaboracion
   */
  rejectInvitation(workflowId: string, collaboratorId: string) {
    return this.http.post<void>(`${this.apiUrl}/${workflowId}/collaborators/${collaboratorId}/reject`, {});
  }

  /**
   * Eliminar colaborador del workflow
   */
  removeCollaborator(workflowId: string, userId: string) {
    return this.http.delete<void>(`${this.apiUrl}/${workflowId}/collaborators/${userId}`);
  }

  /**
   * Cambiar rol de colaborador entre DESIGNER y VIEWER
   */
  changeCollaboratorRole(workflowId: string, userId: string, role: CollaboratorRole) {
    return this.http.put<CollaboratorResponse>(`${this.apiUrl}/${workflowId}/collaborators/${userId}/role`, { role });
  }

  /**
   * Obtener lista de departamentos
   */
  getDepartments() {
    const departmentsUrl = environment.apiUrl.replace('/workflows', '/departments');
    return this.http.get<any[]>(departmentsUrl);
  }

  /**
   * Limpiar estado
   */
  clearCurrentWorkflow() {
    this.currentWorkflowSignal.set(null);
  }

  setCurrentWorkflow(workflow: Workflow) {
    this.currentWorkflowSignal.set(workflow);
  }
}
