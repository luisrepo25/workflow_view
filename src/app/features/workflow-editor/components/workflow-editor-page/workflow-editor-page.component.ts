import { Component, OnDestroy, OnInit, ViewChild, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { WorkflowPaperComponent } from '../workflow-paper/workflow-paper.component';
import { WorkflowPropertiesPanelComponent } from '../workflow-properties-panel/workflow-properties-panel.component';
import { WorkflowAIEditorComponent } from '../workflow-ai-editor/workflow-ai-editor.component';
import { WorkflowEditorService } from '../../services/workflow-editor.service';
import * as joint from 'jointjs';
import {
  DecisionContextField,
  DecisionRulesMode,
  DecisionRulesPatchRequest,
  DecisionRulesSimulateResponse,
  DecisionRulesValidationResult,
  DecisionRule,
  Lane,
  NodeTipo,
  NodeForm,
  Workflow,
  WorkflowChangeMessage,
  WorkflowEdge,
  WorkflowNode
} from '../../../../shared/models/workflow.model';
import { AuthService } from '../../../../core/services/auth.service';
import { WebSocketService } from '../../../../core/services/websocket.service';
import { ToastrService } from 'ngx-toastr';
import { WorkflowService } from '../../../../core/services/workflow.service';
import { UserListItem } from '../../../../core/services/workflow.service';

@Component({
  selector: 'app-workflow-editor-page',
  standalone: true,
  imports: [CommonModule, FormsModule, WorkflowPaperComponent, WorkflowPropertiesPanelComponent, WorkflowAIEditorComponent],
  template: `
    <div class="editor-layout">
      <!-- Top Toolbar -->
      <div class="toolbar">
        <div class="brand">
          <strong>Editor</strong>
        </div>

        <div class="actions">
          <button class="btn btn-create" (click)="openCreateDepartmentModal()">
            + Crear Departamento
          </button>

          <div class="dropdown-container">
            <button class="btn primary" (click)="toggleDepartmentDropdown()">
              + Agregar Calle (Depto)
            </button>
            <div class="dropdown" *ngIf="showDepartmentDropdown">
              <div class="dropdown-item dropdown-state" *ngIf="workflowService.departmentsLoading()">
                Cargando departamentos de empresa...
              </div>

              <div class="dropdown-item dropdown-state dropdown-error" *ngIf="!workflowService.departmentsLoading() && workflowService.departmentsError()">
                <div>{{ workflowService.departmentsError() }}</div>
                <button class="link-button" (click)="onRetryDepartments()">Reintentar</button>
              </div>

              <div class="dropdown-item dropdown-state" *ngIf="!workflowService.departmentsLoading() && !workflowService.departmentsError() && (!workflowService.departments() || workflowService.departments().length === 0)">
                No hay departamentos de empresa configurados.
                <div class="dropdown-help">Pide a administración que registre departamentos para poder crear calles.</div>
                <button class="link-button" (click)="onRetryDepartments()">Reintentar</button>
              </div>

              <ng-container *ngIf="!workflowService.departmentsLoading() && !workflowService.departmentsError() && workflowService.departments() && workflowService.departments().length > 0">
                <button class="dropdown-item" *ngFor="let dept of workflowService.departments()" (click)="onAddLaneFromDepartment(dept)">
                  <span class="dept-name">{{ dept.nombre }}</span>
                  <span class="dept-description" *ngIf="dept.descripcion">{{ dept.descripcion }}</span>
                </button>
              </ng-container>
            </div>
          </div>

          <div class="divider"></div>
          <div class="toolbar-tool-item" draggable="true" (dragstart)="onDragStart($event, 'inicio')">
             <div class="tool-preview preview-inicio"></div>
             <span>Inicio</span>
          </div>
          <div class="toolbar-tool-item" draggable="true" (dragstart)="onDragStart($event, 'actividad')">
             <div class="tool-preview preview-actividad"></div>
             <span>Actividad</span>
          </div>
          <div class="toolbar-tool-item" draggable="true" (dragstart)="onDragStart($event, 'decision')">
             <div class="tool-preview preview-decision"></div>
             <span>Decisión</span>
          </div>
          <div class="toolbar-tool-item" draggable="true" (dragstart)="onDragStart($event, 'fin')">
             <div class="tool-preview preview-fin"></div>
             <span>Fin</span>
          </div>
          <div class="toolbar-tool-item btn-relacionar" [class.btn-armed]="edgeConnectMode" (click)="toggleEdgeConnectMode()">
             <div class="tool-preview preview-relacionar"></div>
             <span>Relacionar</span>
          </div>
        </div>

        <div class="actions-right">
          <button class="btn success" (click)="onSave()">Guardar Diseño</button>
        </div>
      </div>

      <div class="modal-overlay" *ngIf="showCreateDepartmentModal" (click)="closeCreateDepartmentModal()">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <h3>Crear Departamento de Empresa</h3>

          <label class="field-label" for="dept-nombre">Nombre *</label>
          <input
            id="dept-nombre"
            type="text"
            class="field-input"
            [(ngModel)]="newDepartment.nombre"
            placeholder="Ej: Recursos Humanos">

          <label class="field-label" for="dept-desc">Descripción</label>
          <textarea
            id="dept-desc"
            class="field-input"
            rows="3"
            [(ngModel)]="newDepartment.descripcion"
            placeholder="Ej: Gestión del personal"></textarea>

          <label class="field-checkbox">
            <input type="checkbox" [(ngModel)]="newDepartment.activo">
            Departamento activo
          </label>

          <div class="modal-actions">
            <button class="btn" (click)="closeCreateDepartmentModal()" [disabled]="creatingDepartment">Cancelar</button>
            <button class="btn primary" (click)="onCreateDepartment()" [disabled]="creatingDepartment || !newDepartment.nombre.trim()">
              {{ creatingDepartment ? 'Creando...' : 'Crear y Agregar Calle' }}
            </button>
          </div>
        </div>
      </div>

      <div class="editor-body">
        <!-- Main Canvas Area with AI Editor Below -->
        <div class="editor-main">
          <!-- JointJS Canvas Area -->
          <main class="canvas-area" (dragover)="onDragOver($event)" (drop)="onDrop($event)">
             <app-workflow-paper
               [workflowData]="workflowService.workflow()"
               (elementSelected)="onElementSelected($event)"
               (laneClicked)="onLaneClicked($event)"
               (workflowChanged)="onWorkflowChanged($event)">
             </app-workflow-paper>
          </main>

          <!-- AI Editor at the bottom of canvas -->
          <div class="ai-editor-section" *ngIf="workflowService.workflow()">
            <app-workflow-ai-editor
              [currentWorkflow]="workflowService.workflow()!"
              (proposalPreviewed)="onAIProposalPreview($event)"
              (proposalAccepted)="onAIProposalAccepted($event)"
              (proposalDeclined)="onAIProposalDeclined()">
            </app-workflow-ai-editor>
          </div>
        </div>

        <!-- Right Properties Panel -->
        <aside class="sidebar-area">
          <app-workflow-properties-panel
             [selectionType]="selectionType"
             [selectionId]="selectionId"
             [selectionName]="selectionName"
             [nodeType]="nodeType"
             [nodeForm]="nodeForm"
             [nodeResponsableTipo]="nodeResponsableTipo"
             [nodeResponsableUsuarioId]="nodeResponsableUsuarioId"
             [nodeDepartmentId]="nodeDepartmentId"
             [funcionarios]="funcionarios"
             [loadingFuncionarios]="loadingFuncionarios"
             [decisionMode]="decisionMode"
             [decisionRule]="decisionRule"
             [decisionContextFields]="decisionContextFields"
             [decisionDestinationOptions]="decisionDestinationOptions"
             [decisionValidationResult]="decisionValidationResult"
             [decisionSimulationResult]="decisionSimulationResult"
             [decisionBusy]="decisionBusy"
             (propertyChanged)="onPropertyChanged($event)"
             (deleteSelected)="onDeleteSelected()"
             (formChanged)="onFormChanged($event)"
             (decisionRulesChanged)="onDecisionRulesChanged($event)"
             (decisionRulesPersistRequested)="onDecisionRulesPersistRequested($event)"
             (decisionRulesValidateRequested)="onDecisionRulesValidateRequested($event)"
             (decisionRulesSimulateRequested)="onDecisionRulesSimulateRequested($event)">
          </app-workflow-properties-panel>
        </aside>
      </div>
    </div>
  `,
  styles: [`
    .editor-layout {
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
      min-height: 0;
      overflow: hidden;
      background: #f8fafc;
      box-sizing: border-box;
    }
    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 56px;
      padding: 0 16px;
      background: white;
      border-bottom: 1px solid #e2e8f0;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
      z-index: 10;
    }
    .brand {
      font-size: 14px;
      color: #334155;
    }
    .actions, .actions-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .divider {
      width: 1px;
      height: 24px;
      background: #cbd5e1;
      margin: 0 8px;
    }
    .btn {
      padding: 6px 12px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      background: white;
      cursor: pointer;
      font-weight: 500;
      font-size: 13px;
      color: #475569;
      transition: all 0.2s;
    }
    .btn:hover { background: #f8fafc; border-color: #cbd5e1; }
    .btn.primary { background: #eff6ff; color: #2563eb; border-color: #bfdbfe; }
    .btn.primary:hover { background: #dbeafe; }
    .btn.success { background: #16a34a; color: white; border-color: #15803d; }
    .btn.success:hover { background: #15803d; }
    .btn.btn-create { background: #f0fdf4; color: #166534; border-color: #86efac; }
    .btn.btn-create:hover { background: #dcfce7; }
    .btn.btn-armed { background: #fef3c7; color: #92400e; border-color: #fbbf24; }
    
    .toolbar-tool-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 6px 12px;
      cursor: grab;
      border-radius: 6px;
      transition: background 0.2s;
      border: 1px solid transparent;
      user-select: none;
    }
    .toolbar-tool-item:hover {
      background: #f8fafc;
      border-color: #e2e8f0;
    }
    .toolbar-tool-item:active {
      cursor: grabbing;
    }
    .toolbar-tool-item span {
      font-size: 11px;
      font-weight: 500;
      margin-top: 6px;
      color: #475569;
    }
    .btn-relacionar {
      cursor: pointer;
    }
    .btn-relacionar.btn-armed {
      background: #fef3c7;
      border-color: #fbbf24;
    }
    .tool-preview {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .preview-inicio {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #000000;
    }
    .preview-fin {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #000000;
      border: 2px solid #ffffff;
      box-shadow: 0 0 0 2px #000000;
    }
    .preview-actividad {
      width: 30px;
      height: 20px;
      border-radius: 4px;
      border: 2px solid #6366f1;
      background: #ffffff;
    }
    .preview-decision {
      width: 20px;
      height: 20px;
      background: #fef08a;
      border: 2px solid #ca8a04;
      transform: rotate(45deg);
      margin: 2px 0;
    }
    .preview-relacionar {
      width: 30px;
      height: 2px;
      background: #94a3b8;
      position: relative;
    }
    .preview-relacionar::after {
      content: '';
      position: absolute;
      right: -2px;
      top: -4px;
      border-top: 5px solid transparent;
      border-bottom: 5px solid transparent;
      border-left: 6px solid #94a3b8;
    }

    .dropdown-container { position: relative; }
    .dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      background: white;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      min-width: 260px;
      margin-top: 4px;
      z-index: 20;
      overflow: hidden;
    }
    .dropdown-item {
      display: block;
      width: 100%;
      padding: 8px 12px;
      border: none;
      background: none;
      cursor: pointer;
      text-align: left;
      font-size: 13px;
      color: #475569;
      transition: all 0.2s;
    }
    .dropdown-item:hover { background: #f1f5f9; color: #1e293b; }
    .dropdown-state { cursor: default; white-space: normal; line-height: 1.35; }
    .dropdown-error { color: #b91c1c; }
    .dept-name { display: block; font-weight: 600; color: #1e293b; }
    .dept-description { display: block; margin-top: 2px; font-size: 12px; color: #64748b; }
    .dropdown-help { margin-top: 4px; font-size: 12px; color: #64748b; }
    .link-button { margin-top: 8px; border: none; background: none; padding: 0; color: #2563eb; cursor: pointer; font-size: 12px; font-weight: 600; }
    .link-button:hover { text-decoration: underline; }

    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.35);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 40;
    }
    .modal-card {
      width: min(460px, 92vw);
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      box-shadow: 0 14px 28px rgba(15, 23, 42, 0.2);
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .modal-card h3 {
      margin: 0 0 4px;
      font-size: 16px;
      color: #0f172a;
    }
    .field-label {
      font-size: 12px;
      color: #334155;
      font-weight: 600;
    }
    .field-input {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 10px;
      font-size: 13px;
      color: #1e293b;
      background: #fff;
    }
    .field-checkbox {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: #334155;
      margin-top: 2px;
    }
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 4px;
    }
    .editor-body {
      display: flex;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }
    .editor-main {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }
    .canvas-area {
      flex: 1;
      position: relative;
      min-width: 0;
      overflow: auto;
    }
    .ai-editor-section {
      flex-shrink: 0;
      padding: 12px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      max-height: 200px;
      overflow-y: auto;
      box-shadow: 0 -2px 4px rgba(0,0,0,0.02);
    }
    .sidebar-area {
      width: clamp(280px, 24vw, 360px);
      max-width: 100%;
      flex-shrink: 0;
      z-index: 5;
      border-left: 1px solid #e2e8f0;
      background: white;
      overflow: hidden;
    }

    @media (max-width: 1200px) {
      .sidebar-area {
        width: 300px;
      }
    }

    @media (max-width: 900px) {
      .editor-body {
        flex-direction: column;
      }

      .editor-main {
        min-height: 50vh;
      }

      .canvas-area {
        min-height: auto;
      }

      .ai-editor-section {
        max-height: 150px;
      }

      .sidebar-area {
        width: 100%;
        height: 40vh;
        border-left: none;
        border-top: 1px solid #e2e8f0;
      }
    }
  `]
})
export class WorkflowEditorPageComponent implements OnInit, OnDestroy {
  @ViewChild(WorkflowPaperComponent) workflowPaperComponent?: WorkflowPaperComponent;

  public workflowService: WorkflowEditorService = inject(WorkflowEditorService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly websocketService = inject(WebSocketService);
  private readonly toastr = inject(ToastrService);
  private readonly workflowApi = inject(WorkflowService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  private workflowId = '';
  private applyingRemoteChange = false;
  private aiPreviewActive = false;
  private aiPreviewOriginalWorkflow: Workflow | null = null;

  public selectionType: 'Calle' | 'Nodo' | 'Enlace' | null = null;
  public selectionId: string = '';
  public selectionName?: string;
  public nodeType?: string;
  public nodeForm?: NodeForm;
  public nodeResponsableTipo?: 'cliente' | 'usuario' | 'departamento';
  public nodeResponsableUsuarioId?: string;
  /** departmentId del nodo actualmente seleccionado */
  public nodeDepartmentId?: string;
  /** Lista de funcionarios cargados del backend */
  public funcionarios: UserListItem[] = [];
  public loadingFuncionarios = false;
  public decisionMode: DecisionRulesMode = 'binary';
  public decisionRule: DecisionRule | null = null;
  public decisionContextFields: DecisionContextField[] = [];
  public decisionDestinationOptions: Array<{ id: string; name: string }> = [];
  public decisionValidationResult: DecisionRulesValidationResult | null = null;
  public decisionSimulationResult: DecisionRulesSimulateResponse | null = null;
  public decisionBusy = false;
  public pendingNodeType: NodeTipo | null = null;
  public edgeConnectMode = false;
  public showDepartmentDropdown = false;
  public showCreateDepartmentModal = false;
  public creatingDepartment = false;
  public newDepartment: { nombre: string; descripcion: string; activo: boolean } = {
    nombre: '',
    descripcion: '',
    activo: true
  };
  private currentCellView: joint.dia.CellView | null = null;
  private edgeSourceNodeId: string | null = null;

  @ViewChild(WorkflowPaperComponent) paperComponent!: WorkflowPaperComponent;

  ngOnInit(): void {
    const routeId = this.route.snapshot.paramMap.get('id');

    this.loadDepartments();
    this.loadFuncionarios();

    // Si es ruta /workflows/new, mostrar mock local solo para demostración
    // El flujo normal es: usuario crea desde workflow-list → POST /api/workflows → navega a /workflows/{id}
    if (routeId === 'new') {
      this.workflowService.loadWorkflowMock('wf-local-' + Date.now());
      console.warn('⚠️ Modo local: El workflow NO se guardará. Usa el flujo de creación desde la lista.');
      return;
    }

    // Casos normales: cargar workflow existente por ID
    if (!routeId) {
      this.toastr.error('No se especifico un workflow para editar.', 'Workflow');
      this.router.navigate(['/workflows']);
      return;
    }

    this.workflowId = routeId;

    this.workflowService.loadWorkflow(this.workflowId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.initializeRealtime(),
        error: (error) => {
          console.error('Error cargando workflow:', error);
          this.toastr.error('No se pudo cargar el workflow desde el backend.', 'Error');
          this.router.navigate(['/workflows']);
        }
      });
  }

  ngOnDestroy(): void {
    const user = this.authService.currentUser();
    if (this.workflowId && user) {
      this.websocketService.disconnectFromWorkflow(this.workflowId, user.id, user.nombre);
    }

    this.destroy$.next();
    this.destroy$.complete();
  }

  onDragStart(event: DragEvent, type: NodeTipo): void {
    if (event.dataTransfer) {
      event.dataTransfer.setData('application/x-workflow-node-type', type);
      event.dataTransfer.effectAllowed = 'copy';
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault(); // allow drop
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    const type = event.dataTransfer?.getData('application/x-workflow-node-type') as NodeTipo;
    if (!type || !this.paperComponent || !this.paperComponent.getPaper) return;

    // Convert screen coordinates to JointJS paper local coordinates
    const localPoint = this.paperComponent.getPaper.clientToLocalPoint({ x: event.clientX, y: event.clientY });
    
    // Find the lane underneath
    const elementsUnder = this.paperComponent.getPaper.findViewsFromPoint(localPoint);
    let laneId = '';
    for (const view of elementsUnder) {
      if (view.model.get('type') === 'app.Lane') {
        laneId = String(view.model.id);
        break;
      }
    }

    if (!laneId) {
      this.toastr.warning('Debes arrastrar el nodo sobre una calle válida.', 'Ubicación inválida');
      return;
    }

    this.pendingNodeType = type;
    this.onLaneClicked({ laneId, x: localPoint.x, y: localPoint.y });
  }

  onAddLaneFromDepartment(department: any): void {
    const previous = this.workflowService.workflow();
    console.log('WorkflowEditorPage.onAddLaneFromDepartment - selected department', department);

    try {
      this.workflowService.addLaneFromDepartment(department);
      this.showDepartmentDropdown = false;
      const current = this.workflowService.workflow();
      if (previous && current && this.workflowId) {
        this.publishLocalChanges(previous, current);
      }
    } catch (error: any) {
      console.error('WorkflowEditorPage.onAddLaneFromDepartment - error while adding lane', error);
      this.toastr.warning(error?.message || 'No se pudo agregar la calle.', 'Validacion');
    }
  }

  onRetryDepartments(): void {
    this.loadDepartments();
  }

  private loadFuncionarios(): void {
    this.loadingFuncionarios = true;
    this.workflowApi.listUsers({ role: 'Funcionario', activo: true })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (users) => {
          this.funcionarios = users;
          this.loadingFuncionarios = false;
        },
        error: () => {
          this.loadingFuncionarios = false;
        }
      });
  }

  openCreateDepartmentModal(): void {
    this.showCreateDepartmentModal = true;
    this.newDepartment = {
      nombre: '',
      descripcion: '',
      activo: true
    };
  }

  closeCreateDepartmentModal(): void {
    if (this.creatingDepartment) {
      return;
    }
    this.showCreateDepartmentModal = false;
  }

  onCreateDepartment(): void {
    const nombre = this.newDepartment.nombre.trim();
    if (!nombre) {
      this.toastr.warning('El nombre del departamento es obligatorio.', 'Validacion');
      return;
    }

    this.creatingDepartment = true;

    this.workflowService.createDepartmentAndAddLane({
      nombre,
      descripcion: this.newDepartment.descripcion?.trim() || undefined,
      activo: this.newDepartment.activo
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          const current = this.workflowService.workflow();
          if (current && this.workflowId) {
            // Emitir lane_added para otros editores
            const previous: Workflow = {
              ...current,
              lanes: current.lanes.slice(0, -1)
            };
            this.publishLocalChanges(previous, current);
          }
          this.creatingDepartment = false;
          this.showCreateDepartmentModal = false;
          this.showDepartmentDropdown = false;
          this.toastr.success('Departamento creado y calle agregada al diagrama.', 'Exito');
        },
        error: (error: any) => {
          this.creatingDepartment = false;
          const backendMessage = error?.error?.message || error?.message;
          this.toastr.error(backendMessage || 'No se pudo crear el departamento.', 'Error');
        }
      });
  }

  toggleDepartmentDropdown(): void {
    this.showDepartmentDropdown = !this.showDepartmentDropdown;
  }

  onAddNode(tipo: NodeTipo): void {
    this.edgeConnectMode = false;
    this.edgeSourceNodeId = null;
    this.pendingNodeType = tipo;
    this.toastr.info('Haz click sobre una calle para colocar el nodo ' + tipo + '.', 'Modo creacion');
  }

  toggleEdgeConnectMode(): void {
    this.pendingNodeType = null;

    if (this.edgeConnectMode) {
      this.edgeConnectMode = false;
      this.edgeSourceNodeId = null;
      this.toastr.info('Modo relacion desactivado.', 'Relacionar nodos');
      return;
    }

    this.edgeConnectMode = true;
    this.edgeSourceNodeId = null;
    this.toastr.info('Selecciona nodo origen y luego nodo destino para crear la relacion.', 'Relacionar nodos');
  }

  onLaneClicked(event: { laneId: string; x: number; y: number }): void {
    if (!this.pendingNodeType) {
      return;
    }

    const wf = this.workflowService.workflow();
    if (!wf) {
      return;
    }

    const previous = wf;
    const laneNodesCount = wf.nodes.filter((n: WorkflowNode) => n.laneId === event.laneId).length;
    const lane = wf.lanes.find((l: Lane) => l.id === event.laneId);
    const nodeId = `n-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newNode: WorkflowNode = {
      id: nodeId,
      tipo: this.pendingNodeType,
      nombre: this.getDefaultNodeLabel(this.pendingNodeType, laneNodesCount + 1),
      laneId: event.laneId,
      departmentId: lane?.departmentId,
      responsableTipo: this.pendingNodeType === 'actividad' ? 'departamento' : undefined,
      posicionX: Math.round(event.x),
      posicionY: Math.round(event.y),
      ancho: this.pendingNodeType === 'decision' ? 80 : (this.pendingNodeType === 'inicio' || this.pendingNodeType === 'fin' ? 40 : 140),
      alto: this.pendingNodeType === 'decision' ? 80 : (this.pendingNodeType === 'inicio' || this.pendingNodeType === 'fin' ? 40 : 56)
    };

    const updated: Workflow = {
      ...wf,
      nodes: [...wf.nodes, newNode]
    };

    this.workflowService.workflow.set(updated);
    this.publishLocalChanges(previous, updated);
    this.pendingNodeType = null;
  }

  private getDefaultNodeLabel(tipo: NodeTipo, index: number): string {
    switch (tipo) {
      case 'inicio':
        return 'Inicio';
      case 'fin':
        return 'Fin';
      case 'decision':
        return `Decision ${index}`;
      case 'paralelo_inicio':
        return 'Paralelo Inicio';
      case 'paralelo_fin':
        return 'Paralelo Fin';
      default:
        return `Actividad ${index}`;
    }
  }

  onSave(): void {
    if (this.aiPreviewActive) {
      this.toastr.warning('Primero acepta o declina la propuesta de IA antes de guardar.', 'Vista previa IA');
      return;
    }

    const wf = this.workflowService.workflow();
    if (wf && this.workflowId) {
      const hasStartNode = wf.nodes.some((node: WorkflowNode) => node.tipo === 'inicio');
      const hasEndNode = wf.nodes.some((node: WorkflowNode) => node.tipo === 'fin');

      if (!hasStartNode || !hasEndNode) {
        this.toastr.warning('El diseño debe contener al menos un nodo Inicio y un nodo Fin.', 'Validacion');
        return;
      }

      const validationErrors = this.validateBeforeSave(wf);
      if (validationErrors.length > 0) {
        this.toastr.warning(validationErrors[0], 'Validacion');
        return;
      }

      this.workflowService.saveWorkflowDesign(this.workflowId, wf)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (saved: Workflow) => this.workflowService.workflow.set(saved),
          error: (error: unknown) => {
            console.error('Error guardando workflow:', error);
            const backendMessage = (error as any)?.error?.message || (error as any)?.message;
            this.toastr.error(backendMessage || 'No se pudo guardar el diseño en el backend.', 'Error');
          }
        });
    }
  }

  onElementSelected(cellView: joint.dia.CellView | null): void {
    this.currentCellView = cellView;

    if (!cellView) {
      this.selectionType = null;
      this.nodeType = undefined;
      this.nodeForm = undefined;
      this.nodeResponsableTipo = undefined;
      this.nodeResponsableUsuarioId = undefined;
      this.nodeDepartmentId = undefined;
      this.resetDecisionState();
      return;
    }

    const cell = cellView.model;
    this.selectionId = String(cell.id);
    this.selectionName = cell.attr('label/text') || 'Sin Nombre';

    if (cell.get('type') === 'app.Lane') {
      this.selectionType = 'Calle';
      this.nodeType = undefined;
      this.nodeForm = undefined;
      this.nodeResponsableTipo = undefined;
      this.nodeResponsableUsuarioId = undefined;
      this.nodeDepartmentId = undefined;
      this.resetDecisionState();
    } else if (cell.isLink()) {
       this.selectionType = 'Enlace';
       this.nodeType = undefined;
       this.nodeForm = undefined;
       this.nodeResponsableTipo = undefined;
       this.nodeResponsableUsuarioId = undefined;
       this.nodeDepartmentId = undefined;
       this.resetDecisionState();
    } else {
       this.selectionType = 'Nodo';
       
       // Obtener tipo de nodo del workflow model
       const wf = this.workflowService.workflow();
         if (wf) {
         const nodeData = wf.nodes.find((n: WorkflowNode) => n.id === cell.id);
         if (nodeData) {
           this.nodeType = nodeData.tipo;
           this.nodeResponsableTipo = nodeData.responsableTipo;
           this.nodeResponsableUsuarioId = nodeData.responsableUsuarioId;
           this.nodeDepartmentId = nodeData.departmentId;
           
           // Si es actividad, obtener o crear formulario
           if (nodeData.tipo === 'actividad') {
             this.nodeForm = nodeData.form || {
               titulo: nodeData.nombre + ' Form',
               descripcion: '',
               campos: []
             };
             this.resetDecisionState();
           } else if (nodeData.tipo === 'decision') {
             this.nodeForm = undefined;
             this.loadDecisionBuilderState(nodeData, wf);
           } else {
             this.nodeForm = undefined;
             this.resetDecisionState();
           }
         }
       }
    }

    if (this.edgeConnectMode && this.selectionType === 'Nodo') {
      this.handleEdgeConnectSelection(String(cell.id));
    }
  }

  onPropertyChanged(evt: {key: string, value: any}): void {
    if (!this.currentCellView) {
      return;
    }

    if (evt.key === 'name') {
      const nextName = String(evt.value ?? '').trim();
      this.currentCellView.model.attr('label/text', nextName);
      this.selectionName = nextName;

      const wf = this.workflowService.workflow();
      if (!wf || !this.selectionType || !this.selectionId) {
        return;
      }

      const previous = wf;
      let updated: Workflow = wf;

      if (this.selectionType === 'Nodo') {
        updated = {
          ...wf,
          nodes: wf.nodes.map((node: WorkflowNode) =>
            node.id === this.selectionId ? { ...node, nombre: nextName } : node
          )
        };
      } else if (this.selectionType === 'Calle') {
        updated = {
          ...wf,
          lanes: wf.lanes.map((lane: Lane) =>
            lane.id === this.selectionId ? { ...lane, nombre: nextName } : lane
          )
        };
      } else if (this.selectionType === 'Enlace') {
        updated = {
          ...wf,
          edges: wf.edges.map((edge: WorkflowEdge) =>
            edge.id === this.selectionId ? { ...edge, label: nextName } : edge
          )
        };
      }

      if (updated !== previous) {
        this.workflowService.workflow.set(updated);
        this.publishLocalChanges(previous, updated);
      }

      return;
    }

    if (this.selectionType !== 'Nodo') {
      return;
    }

    const wf = this.workflowService.workflow();
    if (!wf) {
      return;
    }

    const nodeIndex = wf.nodes.findIndex((n: WorkflowNode) => n.id === this.selectionId);
    if (nodeIndex < 0) {
      return;
    }

    const selectedNode = wf.nodes[nodeIndex];
    if (selectedNode.tipo !== 'actividad') {
      return;
    }

    const previous = wf;
    const updatedNodes = [...wf.nodes];

    if (evt.key === 'responsableTipo') {
      const nextTipo = evt.value as 'cliente' | 'usuario' | 'departamento';
      updatedNodes[nodeIndex] = {
        ...selectedNode,
        responsableTipo: nextTipo,
        responsableUsuarioId: nextTipo === 'usuario' ? selectedNode.responsableUsuarioId : undefined,
        responsableRole: nextTipo === 'usuario' ? 'Funcionario' : selectedNode.responsableRole
      };
      this.nodeResponsableTipo = nextTipo;
      if (nextTipo !== 'usuario') {
        this.nodeResponsableUsuarioId = undefined;
      }
    }

    if (evt.key === 'responsableUsuarioId') {
      const funcionarioId = String(evt.value ?? '').trim();
      updatedNodes[nodeIndex] = {
        ...selectedNode,
        responsableTipo: 'usuario',
        responsableUsuarioId: funcionarioId || undefined,
        responsableRole: 'Funcionario'
      };
      this.nodeResponsableTipo = 'usuario';
      this.nodeResponsableUsuarioId = funcionarioId || undefined;
    }

    const updated: Workflow = {
      ...wf,
      nodes: updatedNodes
    };

    this.workflowService.workflow.set(updated);
    this.publishLocalChanges(previous, updated);
  }

  onFormChanged(form: NodeForm): void {
    const wf = this.workflowService.workflow();
    if (!wf || !this.nodeType) return;

    const previous = wf;

    const updatedNodes = wf.nodes.map((n: WorkflowNode) => 
      n.id === this.selectionId ? { ...n, form } : n
    );

    const updated: Workflow = {
      ...wf,
      nodes: updatedNodes
    };

    this.workflowService.workflow.set(updated);
    this.publishLocalChanges(previous, updated);

    this.nodeForm = form;
  }

  onDecisionRulesChanged(payload: DecisionRulesPatchRequest): void {
    const wf = this.workflowService.workflow();
    if (!wf || this.selectionType !== 'Nodo' || this.nodeType !== 'decision') {
      return;
    }

    const selectedDecisionNodeId = String(this.selectionId || '').trim();
    if (!selectedDecisionNodeId) {
      return;
    }

    this.decisionMode = payload.mode;
    this.decisionRule = payload.decisionRule;

    const destinations = [];
    if (payload.decisionRule?.onTrueDestinoNodeId) destinations.push(String(payload.decisionRule.onTrueDestinoNodeId).trim());
    if (payload.decisionRule?.onFalseDestinoNodeId) destinations.push(String(payload.decisionRule.onFalseDestinoNodeId).trim());

    const uniqueDestinations = Array.from(new Set(
      destinations.filter((destinoNodeId) => Boolean(destinoNodeId) && destinoNodeId !== selectedDecisionNodeId)
    ));

    const outgoingFromDecision = (wf.edges || []).filter((edge: WorkflowEdge) => edge.fromNodeId === selectedDecisionNodeId);
    const keptOutgoing = outgoingFromDecision.filter((edge: WorkflowEdge) => uniqueDestinations.includes(String(edge.toNodeId || '').trim()));
    const keepOutgoingKeySet = new Set(keptOutgoing.map((edge: WorkflowEdge) => `${edge.fromNodeId}=>${edge.toNodeId}`));

    const outgoingToAdd = uniqueDestinations
      .filter((destinoNodeId) => !keepOutgoingKeySet.has(`${selectedDecisionNodeId}=>${destinoNodeId}`))
      .map((destinoNodeId) => ({
        id: `e-${selectedDecisionNodeId}-${destinoNodeId}`,
        fromNodeId: selectedDecisionNodeId,
        toNodeId: destinoNodeId,
        tipo: 'secuencial' as const
      }));

    const preservedNonDecisionEdges = (wf.edges || []).filter((edge: WorkflowEdge) => edge.fromNodeId !== selectedDecisionNodeId);

    const previous = wf;
    const updated: Workflow = {
      ...wf,
      nodes: wf.nodes.map((node: WorkflowNode) =>
        node.id === this.selectionId
          ? { ...node, decisionRule: payload.decisionRule }
          : node
      ),
      edges: [
        ...preservedNonDecisionEdges,
        ...keptOutgoing,
        ...outgoingToAdd
      ]
    };

    this.workflowService.workflow.set(updated);
    this.publishLocalChanges(previous, updated);
  }

  onDecisionRulesPersistRequested(payload: DecisionRulesPatchRequest): void {
    if (!this.workflowId || !this.selectionId) {
      return;
    }

    this.decisionBusy = true;
    this.workflowApi.patchDecisionRules(this.workflowId, this.selectionId, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.decisionBusy = false;
          this.decisionRule = response.decisionRule || payload.decisionRule;
          this.toastr.success('Reglas de decisión guardadas.', 'Decisión');
        },
        error: (error) => {
          this.decisionBusy = false;
          const message = error?.error?.message || 'No se pudieron guardar las reglas de decisión.';
          this.toastr.error(message, 'Decisión');
        }
      });
  }

  onDecisionRulesValidateRequested(payload: DecisionRulesPatchRequest): void {
    if (!this.workflowId || !this.selectionId) {
      return;
    }

    this.decisionBusy = true;
    this.workflowApi.validateDecisionRules(this.workflowId, this.selectionId, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.decisionBusy = false;
          this.decisionValidationResult = result;
          if (result.valid) {
            this.toastr.success('Reglas válidas.', 'Decisión');
          } else {
            this.toastr.warning(result.errors?.[0] || 'La validación devolvió errores.', 'Decisión');
          }
        },
        error: (error) => {
          this.decisionBusy = false;
          const message = error?.error?.message || 'No se pudo validar las reglas de decisión.';
          this.toastr.error(message, 'Decisión');
        }
      });
  }

  onDecisionRulesSimulateRequested(event: { payload: DecisionRulesPatchRequest; input: Record<string, unknown> }): void {
    if (!this.workflowId || !this.selectionId) {
      return;
    }

    this.decisionBusy = true;
    this.workflowApi.simulateDecisionRules(this.workflowId, this.selectionId, {
      mode: event.payload.mode,
      decisionRule: event.payload.decisionRule,
      input: event.input
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.decisionBusy = false;
          this.decisionSimulationResult = result;
        },
        error: (error) => {
          this.decisionBusy = false;
          const message = error?.error?.message || 'No se pudo simular las reglas de decisión.';
          this.toastr.error(message, 'Decisión');
        }
      });
  }

  private handleEdgeConnectSelection(nodeId: string): void {
    const wf = this.workflowService.workflow();
    if (!wf) {
      return;
    }

    if (!this.edgeSourceNodeId) {
      this.edgeSourceNodeId = nodeId;
      this.toastr.info('Nodo origen seleccionado. Ahora selecciona el nodo destino.', 'Relacionar nodos');
      return;
    }

    if (this.edgeSourceNodeId === nodeId) {
      this.toastr.warning('El nodo destino debe ser diferente al nodo origen.', 'Relacionar nodos');
      return;
    }

    const exists = wf.edges.some((edge: WorkflowEdge) => edge.fromNodeId === this.edgeSourceNodeId && edge.toNodeId === nodeId);
    if (exists) {
      this.toastr.warning('Esa relacion ya existe entre los nodos seleccionados.', 'Relacionar nodos');
      this.edgeConnectMode = false;
      this.edgeSourceNodeId = null;
      return;
    }

    const previous = wf;
    const newEdge: WorkflowEdge = {
      id: `e-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      fromNodeId: this.edgeSourceNodeId,
      toNodeId: nodeId,
      tipo: 'secuencial'
    };

    const updated: Workflow = {
      ...wf,
      edges: [...wf.edges, newEdge]
    };

    this.workflowService.workflow.set(updated);
    this.publishLocalChanges(previous, updated);
    this.edgeConnectMode = false;
    this.edgeSourceNodeId = null;
    this.toastr.success('Relacion creada correctamente.', 'Relacionar nodos');
  }

  onDeleteSelected(): void {
    const wf = this.workflowService.workflow();
    if (!wf || !this.selectionType || !this.selectionId) {
      return;
    }

    const previous = wf;

    if (this.selectionType === 'Calle') {
      const beforeDelete = this.workflowService.workflow();
      try {
        this.workflowService.removeLane(this.selectionId);
      } catch (error: any) {
        this.toastr.warning(error?.message || 'No se pudo eliminar la calle.', 'Validacion');
        return;
      }

      const afterDelete = this.workflowService.workflow();
      if (beforeDelete && afterDelete && this.workflowId) {
        this.publishLocalChanges(beforeDelete, afterDelete);
      }
    } else if (this.selectionType === 'Nodo') {
      const updated: Workflow = {
        ...wf,
        nodes: wf.nodes.filter((node: WorkflowNode) => node.id !== this.selectionId),
        edges: wf.edges.filter((edge: WorkflowEdge) => edge.fromNodeId !== this.selectionId && edge.toNodeId !== this.selectionId)
      };
      this.workflowService.workflow.set(updated);
      this.publishLocalChanges(previous, updated);
    } else if (this.selectionType === 'Enlace') {
      const updated: Workflow = {
        ...wf,
        edges: wf.edges.filter((edge: WorkflowEdge) => edge.id !== this.selectionId)
      };
      this.workflowService.workflow.set(updated);
      this.publishLocalChanges(previous, updated);
    }

    if (this.currentCellView) {
      this.currentCellView.model.remove();
    }

    this.onElementSelected(null);
  }

  onWorkflowChanged(updatedWf: Workflow): void {
      const previous = this.workflowService.workflow();
      this.workflowService.workflow.set(updatedWf);

      if (!previous || this.applyingRemoteChange || !this.workflowId) {
        return;
      }

      this.publishLocalChanges(previous, updatedWf);
  }

  onAIProposalPreview(proposedWorkflow: Workflow): void {
    try {
      const current = this.workflowService.workflow();
      if (!current) {
        return;
      }

      if (!this.aiPreviewActive) {
        this.aiPreviewOriginalWorkflow = this.cloneWorkflow(current);
      }

      this.aiPreviewActive = true;
      this.workflowService.workflow.set(proposedWorkflow);
      this.workflowPaperComponent?.applyRemoteWorkflow(proposedWorkflow);
      this.toastr.info('Vista previa de IA aplicada localmente. Acepta o declina para continuar.', 'Vista previa IA');
    } catch (error: unknown) {
      console.error('WorkflowEditorPageComponent.onAIProposalPreview - Error applying AI preview', error);
      this.toastr.error('No se pudo renderizar la vista previa en el diagrama.', 'Vista previa IA');
      this.resetAIPreviewState();
    }
  }

  onAIProposalAccepted(proposedWorkflow: Workflow): void {
    const baseline = this.aiPreviewOriginalWorkflow ?? this.workflowService.workflow();

    if (!baseline) {
      this.toastr.error('No hay workflow cargado', 'Error');
      return;
    }

    this.logAIProposalDiff(baseline, proposedWorkflow);

    console.log('WorkflowEditorPageComponent.onAIProposalAccepted - Applying AI proposal', {
      proposedLanes: proposedWorkflow.lanes?.length,
      proposedNodes: proposedWorkflow.nodes?.length,
      proposedEdges: proposedWorkflow.edges?.length
    });

    const updatedWorkflow: Workflow = {
      ...baseline,
      lanes: proposedWorkflow.lanes || [],
      nodes: proposedWorkflow.nodes || [],
      edges: proposedWorkflow.edges || [],
      updatedAt: new Date().toISOString()
    };

    try {
      this.workflowService.workflow.set(updatedWorkflow);
      this.workflowPaperComponent?.applyRemoteWorkflow(updatedWorkflow);

      if (this.workflowId) {
        this.publishLocalChanges(baseline, updatedWorkflow, true);
      }

      this.resetAIPreviewState();

      this.toastr.success('Propuesta de IA aplicada exitosamente', 'Éxito');
      
    } catch (error: any) {
      console.error('WorkflowEditorPageComponent.onAIProposalAccepted - Error applying proposal', error);
      this.toastr.error(error?.message || 'Error al aplicar la propuesta', 'Error');
    }
  }

  onAIProposalDeclined(): void {
    console.log('WorkflowEditorPageComponent.onAIProposalDeclined - User declined AI proposal');

    if (this.aiPreviewActive && this.aiPreviewOriginalWorkflow) {
      const restored = this.cloneWorkflow(this.aiPreviewOriginalWorkflow);
      this.workflowService.workflow.set(restored);
      this.workflowPaperComponent?.applyRemoteWorkflow(restored);
    }

    this.resetAIPreviewState();
  }

  private resetAIPreviewState(): void {
    this.aiPreviewActive = false;
    this.aiPreviewOriginalWorkflow = null;
  }

  private cloneWorkflow(workflow: Workflow): Workflow {
    if (typeof globalThis.structuredClone === 'function') {
      return globalThis.structuredClone(workflow);
    }

    return JSON.parse(JSON.stringify(workflow)) as Workflow;
  }

  private logAIProposalDiff(previous: Workflow, current: Workflow): void {
    console.groupCollapsed('WorkflowEditorPageComponent.onAIProposalAccepted - Workflow diff preview');
    console.log('Current edges', this.describeEdges(previous.edges));
    console.log('Proposed normalized edges', this.describeEdges(current.edges));
    console.log('Diff summary', this.buildEdgeDiffSummary(previous, current));
    console.groupEnd();
  }

  private describeEdges(edges: WorkflowEdge[] = []): Array<Record<string, unknown>> {
    return edges.map(edge => ({
      id: edge.id ?? null,
      fromNodeId: edge.fromNodeId,
      toNodeId: edge.toNodeId,
      label: edge.label ?? null,
      tipo: edge.tipo ?? null
    }));
  }

  private buildEdgeDiffSummary(previous: Workflow, current: Workflow): {
    added: Array<Record<string, unknown>>;
    removed: Array<Record<string, unknown>>;
    changed: Array<Record<string, unknown>>;
  } {
    const previousEdges = new Map<string, WorkflowEdge>();
    const currentEdges = new Map<string, WorkflowEdge>();

    for (const edge of previous.edges || []) {
      previousEdges.set(this.getEdgeDiffKey(edge), edge);
    }

    for (const edge of current.edges || []) {
      currentEdges.set(this.getEdgeDiffKey(edge), edge);
    }

    const added = Array.from(currentEdges.entries())
      .filter(([key]) => !previousEdges.has(key))
      .map(([, edge]) => this.describeEdges([edge])[0]);

    const removed = Array.from(previousEdges.entries())
      .filter(([key]) => !currentEdges.has(key))
      .map(([, edge]) => this.describeEdges([edge])[0]);

    const changed = Array.from(currentEdges.entries())
      .filter(([key, edge]) => {
        const previousEdge = previousEdges.get(key);
        if (!previousEdge) return false;
        const e1 = { ...previousEdge, id: undefined };
        const e2 = { ...edge, id: undefined };
        return JSON.stringify(e1) !== JSON.stringify(e2);
      })
      .map(([, edge]) => this.describeEdges([edge])[0]);

    return { added, removed, changed };
  }

  private getEdgeDiffKey(edge: WorkflowEdge): string {
    return `${edge.fromNodeId}=>${edge.toNodeId}`;
  }

  private initializeRealtime(): void {
    const user = this.authService.currentUser();

    if (!user || !this.workflowId) {
      return;
    }

    this.websocketService.connect()
      .then(() => {
        this.websocketService.connectToWorkflow(this.workflowId, user.id, user.nombre);

        this.websocketService.workflowChange$
          .pipe(takeUntil(this.destroy$))
          .subscribe(change => {
            if (!change || change.userId === user.id) {
              return;
            }
            this.applyRemoteChange(change);
          });
      })
      .catch(error => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn('No se pudo conectar a WebSocket:', errorMessage);
        this.toastr.warning('No se pudo conectar al canal en tiempo real. Puedes seguir editando localmente y guardar manualmente.', 'WebSocket');
      });
  }

  private loadDepartments(): void {
    this.workflowService.loadDepartments()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        error: (error: unknown) => console.error('Error cargando departamentos:', error)
      });
  }

  private publishLocalChanges(previous: Workflow, current: Workflow, force = false): void {
    if (this.aiPreviewActive && !force) {
      return;
    }

    const user = this.authService.currentUser();
    if (!user || !this.websocketService.isConnected()) {
      return;
    }

    const previousLanes = new Map(previous.lanes.map(lane => [lane.id, lane]));
    const currentLanes = new Map(current.lanes.map(lane => [lane.id, lane]));

    for (const [laneId, lane] of currentLanes) {
      const previousLane = previousLanes.get(laneId);
      if (!previousLane) {
        this.websocketService.addLane(this.workflowId, lane, user.id, user.nombre);
        continue;
      }

      if (JSON.stringify(previousLane) !== JSON.stringify(lane)) {
        this.websocketService.updateLane(this.workflowId, lane, user.id, user.nombre);
      }
    }

    for (const laneId of previousLanes.keys()) {
      if (!currentLanes.has(laneId)) {
        this.websocketService.deleteLane(this.workflowId, laneId, user.id, user.nombre);
      }
    }

    const previousNodes = new Map(previous.nodes.map(node => [node.id, node]));
    const currentNodes = new Map(current.nodes.map(node => [node.id, node]));

    for (const [nodeId, node] of currentNodes) {
      const previousNode = previousNodes.get(nodeId);
      if (!previousNode) {
        this.websocketService.addNode(this.workflowId, node, user.id, user.nombre);
        continue;
      }

      if (JSON.stringify(previousNode) !== JSON.stringify(node)) {
        this.websocketService.updateNode(this.workflowId, node, user.id, user.nombre);
      }
    }

    for (const nodeId of previousNodes.keys()) {
      if (!currentNodes.has(nodeId)) {
        this.websocketService.deleteNode(this.workflowId, nodeId, user.id, user.nombre);
      }
    }

    const getEdgeKey = (edge: WorkflowEdge) => `${edge.fromNodeId}=>${edge.toNodeId}`;

    const previousEdges = new Map<string, WorkflowEdge>(
      previous.edges.map((edge) => [getEdgeKey(edge), edge])
    );
    const currentEdges = new Map<string, WorkflowEdge>(
      current.edges.map((edge) => [getEdgeKey(edge), edge])
    );

    for (const [edgeKey, edge] of currentEdges) {
      const previousEdge = previousEdges.get(edgeKey);
      if (!previousEdge) {
        this.websocketService.addEdge(this.workflowId, edge, user.id, user.nombre);
        continue;
      }

      const isDifferent = previousEdge.label !== edge.label || previousEdge.tipo !== edge.tipo;

      if (isDifferent) {
        this.websocketService.deleteEdge(this.workflowId, {
          id: previousEdge.id || edge.id,
          fromNodeId: previousEdge.fromNodeId,
          toNodeId: previousEdge.toNodeId
        }, user.id, user.nombre);
        this.websocketService.addEdge(this.workflowId, edge, user.id, user.nombre);
      }
    }

    for (const [edgeKey, edge] of previousEdges) {
      if (!currentEdges.has(edgeKey)) {
        this.websocketService.deleteEdge(this.workflowId, {
          id: edge.id,
          fromNodeId: edge.fromNodeId,
          toNodeId: edge.toNodeId
        }, user.id, user.nombre);
      }
    }
  }

  private applyRemoteChange(change: WorkflowChangeMessage): void {
    const current = this.workflowService.workflow();
    if (!current) {
      return;
    }

    let updated: Workflow = current;

    switch (change.action) {
      case 'lane_added':
      case 'lane_updated': {
        const laneData = change.data;
        const laneId = String(laneData?.id ?? change.laneId ?? '').trim();
        if (!laneId) return;

        const incomingLane: Lane = {
          ...laneData,
          id: laneId,
          nombre: String(laneData?.nombre ?? 'Calle'),
          responsable: String(laneData?.responsable ?? laneData?.nombre ?? 'Departamento'),
          orden: Number(laneData?.orden ?? 0)
        };

        const lanes = [...current.lanes];
        const existingIndex = lanes.findIndex(l => l.id === laneId);
        
        if (existingIndex >= 0) {
          lanes[existingIndex] = incomingLane;
        } else {
          lanes.push(incomingLane);
        }

        lanes.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
        updated = { ...current, lanes };
        break;
      }
      case 'lane_deleted': {
        const laneId = String(change.laneId ?? change.data?.id ?? '').trim();
        if (!laneId) return;

        updated = {
          ...current,
          lanes: current.lanes.filter(l => l.id !== laneId),
          nodes: current.nodes.filter(n => n.laneId !== laneId)
        };
        break;
      }
      case 'node_added':
      case 'node_updated': {
        const nodeData = change.data;
        const nodeId = String(nodeData?.id ?? change.nodeId ?? '').trim();
        if (!nodeId) return;

        const incomingNode: WorkflowNode = {
          ...nodeData,
          id: nodeId,
          tipo: nodeData?.tipo ?? 'actividad',
          laneId: String(nodeData?.laneId ?? nodeData?.parentId ?? ''),
          nombre: String(nodeData?.nombre ?? 'Nodo'),
          posicionX: Number(nodeData?.posicionX ?? nodeData?.x ?? 0),
          posicionY: Number(nodeData?.posicionY ?? nodeData?.y ?? 0)
        };

        const nodes = [...current.nodes];
        const existingIndex = nodes.findIndex(n => n.id === nodeId);

        if (existingIndex >= 0) {
          nodes[existingIndex] = incomingNode;
        } else {
          nodes.push(incomingNode);
        }

        updated = { ...current, nodes };
        break;
      }
      case 'node_deleted': {
        const nodeId = String(change.nodeId ?? change.data?.id ?? '').trim();
        if (!nodeId) return;

        updated = {
          ...current,
          nodes: current.nodes.filter(n => n.id !== nodeId),
          edges: current.edges.filter(e => e.fromNodeId !== nodeId && e.toNodeId !== nodeId)
        };
        break;
      }
      case 'edge_added': {
        const edgeData = change.data;
        const fromNodeId = String(edgeData?.fromNodeId ?? edgeData?.sourceId ?? '');
        const toNodeId = String(edgeData?.toNodeId ?? edgeData?.targetId ?? '');
        const edgeId = String(edgeData?.id ?? `e-${fromNodeId}-${toNodeId}`);

        if (!fromNodeId || !toNodeId) return;

        const incomingEdge: WorkflowEdge = {
          ...edgeData,
          id: edgeId,
          fromNodeId,
          toNodeId
        };

        const edges = [...current.edges];
        const existingIndex = edges.findIndex(e => e.id === edgeId);

        if (existingIndex >= 0) {
          edges[existingIndex] = incomingEdge;
        } else {
          edges.push(incomingEdge);
        }

        updated = { ...current, edges };
        break;
      }
      case 'edge_deleted': {
        const edgeId = String(change.edgeId ?? change.data?.id ?? '').trim();
        const fromNodeId = String(change.data?.fromNodeId ?? '').trim();
        const toNodeId = String(change.data?.toNodeId ?? '').trim();

        if (!edgeId && (!fromNodeId || !toNodeId)) return;

        updated = {
          ...current,
          edges: current.edges.filter(e => {
            if (edgeId && e.id === edgeId) {
              return false;
            }

            if (fromNodeId && toNodeId) {
              return !(e.fromNodeId === fromNodeId && e.toNodeId === toNodeId);
            }

            return true;
          })
        };
        break;
      }
      default:
        return;
    }

    this.applyingRemoteChange = true;
    this.workflowService.workflow.set(updated);

    // Fuerza el redibuje inmediato del diagrama para cambios remotos.
    this.workflowPaperComponent?.applyRemoteWorkflow(updated);
    
    this.applyingRemoteChange = false;
  }

  private loadDecisionBuilderState(node: WorkflowNode, workflow: Workflow): void {
    const selectedNodeId = this.normalizeEntityId(node.id);

    if (node.decisionRule) {
      this.decisionRule = { ...node.decisionRule };
    } else {
      this.decisionRule = {
        field: '',
        operator: '',
        value: '',
        onTrueDestinoNodeId: '',
        onFalseDestinoNodeId: ''
      };
    }

    this.decisionValidationResult = null;
    this.decisionSimulationResult = null;
    this.decisionDestinationOptions = (workflow.nodes || [])
      .filter((item: WorkflowNode) => this.normalizeEntityId(item.id) !== selectedNodeId)
      .map((item: WorkflowNode) => ({
        id: this.normalizeEntityId(item.id),
        name: `${item.nombre} (${item.tipo})`
      }));

    console.log('WorkflowEditorPage.loadDecisionBuilderState - final decision model', {
      decisionRule: this.decisionRule,
      decisionDestinationOptions: this.decisionDestinationOptions
    });

    if (!this.workflowId || !node.id) {
      this.decisionContextFields = [];
      return;
    }

    this.workflowApi.getDecisionContext(this.workflowId, node.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (context) => {
          this.decisionContextFields = context.fields || [];
          this.cdr.detectChanges();
        },
        error: (error) => {
          this.decisionContextFields = [];
          const message = error?.error?.message || 'No se pudo cargar el contexto de decisión.';
          this.toastr.warning(message, 'Decisión');
          this.cdr.detectChanges();
        }
      });
  }

  private resetDecisionState(): void {
    this.decisionMode = 'binary';
    this.decisionRule = null;
    this.decisionContextFields = [];
    this.decisionDestinationOptions = [];
    this.decisionValidationResult = null;
    this.decisionSimulationResult = null;
    this.decisionBusy = false;
  }


  private normalizeEntityId(value: unknown): string {
    const raw = String(value ?? '').trim();
    if (!raw) {
      return '';
    }

    const objectIdMatch = raw.match(/^ObjectId\((['"]?)(.+?)\1\)$/i);
    if (objectIdMatch?.[2]) {
      return objectIdMatch[2].trim();
    }

    const wrappedQuotesMatch = raw.match(/^['"](.+)['"]$/);
    if (wrappedQuotesMatch?.[1]) {
      return wrappedQuotesMatch[1].trim();
    }

    return raw;
  }

  private normalizeObjectId(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return '';
      }

      const objectIdMatch = trimmed.match(/^ObjectId\((['"]?)(.+?)\1\)$/i);
      if (objectIdMatch?.[2]) {
        return objectIdMatch[2].trim();
      }

      const wrappedQuotesMatch = trimmed.match(/^['"](.+)['"]$/);
      if (wrappedQuotesMatch?.[1]) {
        return wrappedQuotesMatch[1].trim();
      }

      return trimmed;
    }

    if (typeof value === 'object') {
      const objectValue = value as Record<string, unknown>;
      const candidate = objectValue['$oid'] ?? objectValue['oid'] ?? objectValue['id'] ?? objectValue['value'];
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }

    const normalized = String(value).trim();
    return normalized === '[object Object]' ? '' : normalized;
  }



  private getOutgoingTargetsFromGraph(nodeId: string): string[] {
    const graph = this.currentCellView?.model?.graph;
    if (!graph || !nodeId) {
      return [];
    }

    const links = graph.getLinks() || [];
    return Array.from(new Set(
      links
        .filter((link) => this.normalizeEntityId(link.get('source')?.id) === nodeId)
        .map((link) => this.normalizeEntityId(link.get('target')?.id))
        .filter((targetId) => Boolean(targetId))
    ));
  }

  private validateBeforeSave(workflow: Workflow): string[] {
    const errors: string[] = [];
    const laneDepartmentMap = new Map<string, string>();

    for (const lane of workflow.lanes || []) {
      const laneId = String(lane.id ?? '').trim();
      if (!laneId) {
        continue;
      }
      laneDepartmentMap.set(laneId, this.normalizeObjectId(lane.departmentId));
    }

    const relationKeys = new Set<string>();
    for (const edge of workflow.edges || []) {
      const key = `${edge.fromNodeId}=>${edge.toNodeId}`;
      if (relationKeys.has(key)) {
        errors.push('Existe al menos una relación duplicada entre el mismo nodo origen y destino.');
        break;
      }
      relationKeys.add(key);
    }

    for (const node of workflow.nodes || []) {
      if (node.tipo !== 'decision') {
        continue;
      }

      const outgoing = (workflow.edges || []).filter((edge: WorkflowEdge) => edge.fromNodeId === node.id);
      if (outgoing.length === 0) {
        errors.push(`El nodo de decisión "${node.nombre}" debe tener al menos una salida.`);
        break;
      }
    }

    for (const node of workflow.nodes || []) {
      if (node.tipo !== 'actividad' || node.responsableTipo !== 'usuario') {
        continue;
      }

      const funcionarioId = (node.responsableUsuarioId || '').trim();
      if (!/^[a-fA-F0-9]{24}$/.test(funcionarioId)) {
        errors.push(`El nodo de actividad "${node.nombre}" tiene un funcionario inválido. Debe ser ObjectId de 24 hex.`);
        break;
      }
    }

    for (const node of workflow.nodes || []) {
      const laneId = String(node.laneId ?? '').trim();
      const laneDepartmentId = laneDepartmentMap.get(laneId);
      if (!laneDepartmentId) {
        errors.push(`El nodo "${node.nombre}" no tiene una lane válida con departmentId.`);
        break;
      }

      const nodeDepartmentId = this.normalizeObjectId(node.departmentId);
      if (nodeDepartmentId && nodeDepartmentId !== laneDepartmentId) {
        errors.push(`El nodo "${node.nombre}" tiene departmentId distinto al de su lane.`);
        break;
      }
    }

    return errors;
  }
}
