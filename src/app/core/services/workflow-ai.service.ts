import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../config/environment';
import { Workflow, WorkflowNode, Lane } from '../../shared/models/workflow.model';
import { DepartmentService } from './department.service';
import { WorkflowService } from './workflow.service';
import { v4 as uuidv4 } from 'uuid';

export interface WorkflowAIEditRequest {
  requestId: string;
  mode: 'edit_workflow';
  userInstruction: string;
  currentWorkflow: Workflow;
  catalogs: {
    departments: Array<{ id: string; nombre: string }>;
    users: Array<{ id: string; nombre: string; departmentId: string }>;
    allowedResponsableRoles: string[];
  };
  rules: {
    mustReturnOnlyJson: boolean;
    preserveExistingIds: boolean;
    strictValidation: boolean;
  };
}

export interface WorkflowAIEditResponse extends Workflow {
  // La respuesta IA retorna un Workflow completo
}

@Injectable({
  providedIn: 'root'
})
export class WorkflowAIService {
  private readonly http = inject(HttpClient);
  private readonly departmentService = inject(DepartmentService);
  private readonly workflowService = inject(WorkflowService);

  /**
   * Envía el contexto del workflow actual a la IA con instrucciones de edición
   * @param userInstruction Instrucciones del usuario para modificar el workflow
   * @param currentWorkflow Workflow actual que se desea editar
   * @returns Observable con el workflow propuesto por la IA
   */
  public editWorkflowWithAI(
    userInstruction: string,
    currentWorkflow: Workflow
  ): Observable<WorkflowAIEditResponse> {
    const endpoint = `${environment.apiIaUrl}/ai/workflow/editar`;

    // Construir catálogos
    const departments = this.departmentService.departments() || [];
    // Para los usuarios, usaremos un array vacío por ahora ya que listUsers retorna un Observable
    // El backend puede agregar usuarios adicionales si es necesario
    const users: Array<{ id: string; nombre: string; departmentId: string }> = [];

    const workflowSnapshot = this.cloneWorkflow(currentWorkflow);

    const payload: WorkflowAIEditRequest = {
      requestId: uuidv4(),
      mode: 'edit_workflow',
      userInstruction: userInstruction.trim(),
      currentWorkflow: workflowSnapshot,
      catalogs: {
        departments: departments.map(d => ({
          id: d.id || '',
          nombre: d.nombre || ''
        })),
        users,
        allowedResponsableRoles: ['Cliente', 'Funcionario', 'Disenador', 'Administrador']
      },
      rules: {
        mustReturnOnlyJson: true,
        preserveExistingIds: true,
        strictValidation: true
      }
    };

    console.log('WorkflowAIService.editWorkflowWithAI - Sending request to IA', {
      endpoint,
      requestId: payload.requestId,
      instruction: userInstruction
    });

    return this.http.post<WorkflowAIEditResponse>(endpoint, payload);
  }

  private cloneWorkflow(workflow: Workflow): Workflow {
    if (typeof globalThis.structuredClone === 'function') {
      return globalThis.structuredClone(workflow);
    }

    return JSON.parse(JSON.stringify(workflow)) as Workflow;
  }
}
