import { Injectable, inject, signal, computed } from '@angular/core';
import { tap } from 'rxjs';
import { Workflow, Lane, WorkflowNode } from '../../../shared/models/workflow.model';
import { WorkflowService } from '../../../core/services/workflow.service';
import { DepartmentService, DepartmentCreateRequest } from '../../../core/services/department.service';

@Injectable({
  providedIn: 'root'
})
export class WorkflowEditorService {
  private readonly workflowApi = inject(WorkflowService);
  private readonly departmentApi = inject(DepartmentService);

  public workflow = signal<Workflow | null>(null);
  public departments = computed(() => this.departmentApi.departments());
  public departmentsLoading = computed(() => this.departmentApi.isLoading());
  public departmentsError = computed(() => this.departmentApi.error());

  public loadWorkflowMock(id: string): void {
    const mockWf: Workflow = {
      id,
      codigo: 'WF-MOCK-001',
      nombre: 'Proceso de Aprobación Genérico',
      descripcion: 'Flujo estándar con 2 carriles',
      estado: 'borrador',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'Admin',
      lanes: [
        { id: 'l1', nombre: 'Recursos Humanos', responsable: 'RRHH', orden: 1, departmentId: '65f1a2b3c4d5e6f7890a1b2c' },
        { id: 'l2', nombre: 'Sistemas', responsable: 'IT', orden: 2, departmentId: '65f1a2b3c4d5e6f7890a1b2d' }
      ],
      nodes: [
        { id: 'n1', tipo: 'inicio', nombre: 'Inicio', laneId: 'l1', departmentId: '65f1a2b3c4d5e6f7890a1b2c', posicionX: 50, posicionY: 100 },
        { id: 'n2', tipo: 'actividad', nombre: 'Verificar Doc', laneId: 'l1', departmentId: '65f1a2b3c4d5e6f7890a1b2c', responsableTipo: 'departamento', posicionX: 50, posicionY: 300, ancho: 120, alto: 60 },
        { id: 'n3', tipo: 'fin', nombre: 'Fin', laneId: 'l2', departmentId: '65f1a2b3c4d5e6f7890a1b2d', posicionX: 50, posicionY: 500 }
      ],
      edges: [
        { id: 'e1', fromNodeId: 'n1', toNodeId: 'n2' },
        { id: 'e2', fromNodeId: 'n2', toNodeId: 'n3' }
      ]
    };

    this.workflow.set(mockWf);
  }

  public loadWorkflow(id: string) {
    console.log('WorkflowEditorService.loadWorkflow - loading workflow from backend', { id });
    
    return this.workflowApi.getWorkflow(id).pipe(
      tap(workflow => {
        console.log('WorkflowEditorService.loadWorkflow - backend response received', {
          workflowId: workflow?.id,
          laneCount: workflow?.lanes?.length || 0,
          nodeCount: workflow?.nodes?.length || 0,
          edgeCount: workflow?.edges?.length || 0,
          workflowState: workflow?.estado
        });
        
        if (!workflow) {
          console.error('WorkflowEditorService.loadWorkflow - backend returned null workflow');
          return;
        }

        // Validar estructura básica
        const hasValidLanes = Array.isArray(workflow.lanes) && workflow.lanes.length > 0;
        const hasValidNodes = Array.isArray(workflow.nodes);
        const hasValidEdges = Array.isArray(workflow.edges);

        if (!hasValidLanes) {
          console.warn('WorkflowEditorService.loadWorkflow - workflow has no lanes or lanes is not an array');
        }
        
        if (!hasValidNodes) {
          console.warn('WorkflowEditorService.loadWorkflow - workflow has no nodes or nodes is not an array');
          if (!workflow.nodes) workflow.nodes = [];
        }
        
        if (!hasValidEdges) {
          console.warn('WorkflowEditorService.loadWorkflow - workflow has no edges or edges is not an array');
          if (!workflow.edges) workflow.edges = [];
        }

        this.workflow.set(workflow);
        console.log('WorkflowEditorService.loadWorkflow - workflow set in signal successfully');
      })
    );
  }

  public saveWorkflowDesign(workflowId: string, workflow: Workflow) {
    const sanitized = this.sanitizeWorkflowForPersistence(workflow);

    return this.workflowApi
      .saveDesign(workflowId, {
        lanes: sanitized.lanes,
        nodes: sanitized.nodes,
        edges: sanitized.edges
      })
      .pipe(tap(saved => this.workflow.set(saved)));
  }

  public loadDepartments() {
    return this.departmentApi.getDepartments();
  }

  public retryDepartmentsLoad() {
    return this.loadDepartments();
  }

  public createDepartmentAndAddLane(payload: DepartmentCreateRequest) {
    return this.departmentApi.createDepartment(payload).pipe(
      tap(createdDepartment => {
        this.addLaneFromDepartment(createdDepartment);
      })
    );
  }

  public addLaneFromDepartment(department: any): void {
    const wf = this.workflow();
    if (!wf) return;

    console.log('WorkflowEditorService.addLaneFromDepartment - input department', department);

    const departmentId = this.resolveDepartmentId(department);
    const departmentName = this.normalizeComparableName(department?.nombre);

    console.log('WorkflowEditorService.addLaneFromDepartment - normalized values', {
      departmentId,
      departmentName,
      hasId: this.isValidId(departmentId),
      laneCount: wf.lanes?.length || 0
    });

    if (!this.isValidId(departmentId)) {
      console.error('WorkflowEditorService.addLaneFromDepartment - invalid department ID', {
        rawDepartment: department,
        receivedId: {
          id: department?.id,
          _id: department?._id,
          departmentId: department?.departmentId,
          departamentoId: department?.departamentoId
        },
        normalizedDepartmentId: departmentId
      });
      throw new Error(`El departamento no tiene un ID válido. Recibido: "${departmentId}"`);
    }

    const incomingDepartmentKey = departmentId || departmentName;

    if (!incomingDepartmentKey) {
      throw new Error('No se pudo identificar el departamento para agregar la calle.');
    }

    const alreadyExists = (wf.lanes || []).some((lane: Lane) => {
      const laneDepartmentId = this.normalizeComparableId(lane.departmentId);
      const laneName = this.normalizeComparableName(lane.nombre);
      const laneDepartmentKey = laneDepartmentId || laneName;
      return laneDepartmentKey === incomingDepartmentKey;
    });

    if (alreadyExists) {
      throw new Error('Ese departamento ya existe como calle en el diagrama.');
    }

    const laneOrder = (wf.lanes?.length || 0) + 1;
    const newLane = this.departmentApi.departmentToLane(department, laneOrder);

    console.log('WorkflowEditorService.addLaneFromDepartment - new lane generated', newLane);

    this.workflow.set({
      ...wf,
      lanes: [...(wf.lanes || []), newLane]
    });

    console.log('WorkflowEditorService.addLaneFromDepartment - lane added successfully', {
      workflowId: wf.id,
      newLaneId: newLane?.id,
      newLaneDepartmentId: newLane?.departmentId
    });
  }

  private normalizeComparableId(rawId: unknown): string {
    console.log('WorkflowEditorService.normalizeComparableId - raw input', rawId);

    if (rawId === null || rawId === undefined) {
      console.log('WorkflowEditorService.normalizeComparableId - output empty string because value is null/undefined');
      return '';
    }

    if (typeof rawId === 'string') {
      const trimmed = rawId.trim();
      console.log('WorkflowEditorService.normalizeComparableId - output from string', trimmed);
      return trimmed;
    }

    if (typeof rawId === 'object') {
      const candidate = (rawId as any).$oid ?? (rawId as any).oid ?? (rawId as any).id ?? (rawId as any).value;
      if (typeof candidate === 'string' && candidate.trim()) {
        const trimmedCandidate = candidate.trim();
        console.log('WorkflowEditorService.normalizeComparableId - output from object candidate', trimmedCandidate);
        return trimmedCandidate;
      }
    }

    const normalized = String(rawId).trim();
    const output = normalized === '[object Object]' ? '' : normalized;
    console.log('WorkflowEditorService.normalizeComparableId - output fallback', output);
    return output;
  }

  private normalizeComparableName(rawName: unknown): string {
    const normalized = String(rawName ?? '').trim().toLowerCase();
    return normalized.replace(/\s+/g, ' ');
  }

  private resolveDepartmentId(department: any): string {
    const candidates = [
      department?.id,
      department?._id,
      department?.departmentId,
      department?.departamentoId,
      department?.ID,
      department?.Id
    ];

    for (const candidate of candidates) {
      const normalized = this.normalizeComparableId(candidate);
      if (normalized) {
        return normalized;
      }
    }

    return '';
  }

  public removeLane(laneId: string): void {
    const wf = this.workflow();
    if (!wf) return;

    const nodesInLane = (wf.nodes || []).filter(n => n.laneId === laneId);
    if (nodesInLane.length > 0) {
      throw new Error('No se puede eliminar una calle que contiene nodos. Elimina los nodos primero.');
    }

    this.workflow.set({
      ...wf,
      lanes: (wf.lanes || []).filter(l => l.id !== laneId)
    });
  }

  private sanitizeWorkflowForPersistence(workflow: Workflow): Workflow {
    const laneToDepartmentId = new Map<string, string>();

    // 1. Sanear Calles (Lanes)
    const lanes = (workflow.lanes || []).map((lane: Lane) => {
      const normalizedDepartmentId = this.normalizeComparableId(lane.departmentId);
      const sanitizedLane: Lane = {
        ...lane,
        id: String(lane.id),
        nombre: String(lane.nombre ?? '').trim(),
        responsable: String(lane.responsable ?? lane.nombre ?? '').trim(),
        orden: Number(lane.orden ?? 0),
        departmentId: normalizedDepartmentId
      };

      if (this.isValidId(normalizedDepartmentId)) {
        laneToDepartmentId.set(sanitizedLane.id, normalizedDepartmentId);
      }

      return sanitizedLane;
    });

    const validLaneIds = new Set(lanes.map((lane: Lane) => lane.id));

    // 2. Sanear Nodos
    const nodes = (workflow.nodes || []).map((node: WorkflowNode) => {
      const laneId = String(node.laneId ?? '').trim();
      const laneDepartmentId = laneToDepartmentId.get(laneId);
      const currentDepartmentId = this.normalizeComparableId(node.departmentId);
      
      // PRIORIDAD ABSOLUTA: El ID del departamento de la calle en la que está el nodo.
      // Si el nodo está en una calle, DEBE pertenecer al departamento de esa calle.
      const finalDepartmentId = laneDepartmentId || currentDepartmentId;

      const sanitizedNode: WorkflowNode = {
        ...node,
        id: String(node.id),
        laneId,
        tipo: node.tipo,
        nombre: String(node.nombre ?? '').trim(),
        posicionX: Number(node.posicionX ?? node.x ?? 0),
        posicionY: Number(node.posicionY ?? node.y ?? 0),
        ancho: Number(node.ancho ?? (node.tipo === 'decision' ? 80 : 140)),
        alto: Number(node.alto ?? (node.tipo === 'decision' ? 80 : 56)),
        departmentId: finalDepartmentId || undefined
      };

      // Si es actividad y no tiene tipo de responsable, por defecto es departamento
      if (sanitizedNode.tipo === 'actividad') {
        sanitizedNode.responsableTipo = sanitizedNode.responsableTipo ?? 'departamento';
      }

      if (node.form) {
        sanitizedNode.form = this.sanitizeNodeForm(node.form);
      }

      if (node.decisionRule) {
        sanitizedNode.decisionRule = {
          ...node.decisionRule,
          onTrueDestinoNodeId: String(node.decisionRule.onTrueDestinoNodeId ?? '').trim(),
          onFalseDestinoNodeId: String(node.decisionRule.onFalseDestinoNodeId ?? '').trim(),
          field: String(node.decisionRule.field ?? '').trim(),
          operator: String(node.decisionRule.operator ?? '').trim(),
          value: String(node.decisionRule.value ?? '').trim()
        };
      }

      return sanitizedNode;
    });

    // 3. Sanear Enlaces (Edges)
    const validNodeIds = new Set(nodes.map((node: WorkflowNode) => node.id));
    const edges = (workflow.edges || [])
      .map((edge, index) => {
        const fromNodeId = edge.fromNodeId ? String(edge.fromNodeId).trim() : '';
        const toNodeId = edge.toNodeId ? String(edge.toNodeId).trim() : '';
        const fallbackId = `e-${fromNodeId || 'from'}-${toNodeId || 'to'}-${index}`;

        return {
          ...edge,
          id: edge.id ? String(edge.id) : fallbackId,
          fromNodeId,
          toNodeId
        };
      })
      .filter(edge => edge.fromNodeId && edge.toNodeId && validNodeIds.has(edge.fromNodeId) && validNodeIds.has(edge.toNodeId));

    return {
      ...workflow,
      lanes,
      nodes,
      edges
    };
  }

  private isValidId(value: string): boolean {
    return typeof value === 'string' && value.trim().length > 0;
  }

  private sanitizeNodeForm(form: NonNullable<WorkflowNode['form']>): NonNullable<WorkflowNode['form']> {
    return {
      ...form,
      titulo: String(form.titulo ?? form.nombre ?? '').trim(),
      descripcion: form.descripcion ? String(form.descripcion).trim() : undefined,
      campos: (form.campos || []).map(field => ({
        ...field,
        id: String(field.id),
        label: String(field.label ?? field.nombre ?? '').trim(),
        tipo: field.tipo,
        required: Boolean(field.required ?? field.obligatorio),
        options: (field.options ?? field.opciones ?? []).map(option => String(option).trim()).filter(Boolean),
        placeholder: field.placeholder ? String(field.placeholder).trim() : undefined
      }))
    };
  }
}
