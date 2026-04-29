import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, HostListener, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as joint from 'jointjs';
import { JointjsPaperService } from '../../services/jointjs-paper.service';
import { LaneLayoutService } from '../../services/lane-layout.service';
import { WorkflowSerializationService } from '../../services/workflow-serialization.service';
import { Workflow } from '../../../../shared/models/workflow.model';

@Component({
  selector: 'app-workflow-paper',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="paper-wrapper" #wrapper>
      <div #paperContainer class="jointjs-paper"></div>
      
      <!-- Floating Toolbar -->
      <div class="canvas-controls">
        <button (click)="zoomIn()" title="Aumentar Zoom">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </button>
        <div class="zoom-level">{{ (scale * 100).toFixed(0) }}%</div>
        <button (click)="zoomOut()" title="Disminuir Zoom">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </button>
        <div class="control-divider"></div>
        <button (click)="fitToContent()" title="Ajustar al Contenido">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .paper-wrapper {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #f1f5f9;
      position: relative;
      cursor: grab;
    }
    .paper-wrapper:active {
      cursor: grabbing;
    }
    .jointjs-paper {
      width: 100%;
      height: 100%;
      touch-action: none;
    }

    .canvas-controls {
      position: absolute;
      bottom: 20px;
      left: 20px;
      background: white;
      border-radius: 12px;
      display: flex;
      align-items: center;
      padding: 6px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.1);
      border: 1px solid #e2e8f0;
      gap: 4px;
      z-index: 10;
    }

    .canvas-controls button {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      border: none;
      background: #ffffff;
      color: #1e293b;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .canvas-controls button:hover {
      background: #f8fafc;
      color: #3b82f6;
      box-shadow: 0 2px 5px rgba(0,0,0,0.15);
    }

    .canvas-controls button svg {
      width: 18px;
      height: 18px;
      stroke: currentColor;
      stroke-width: 2.5;
    }

    .zoom-level {
      font-size: 11px;
      font-weight: 700;
      color: #1e293b;
      min-width: 40px;
      text-align: center;
      user-select: none;
    }

    .control-divider {
      width: 1px;
      height: 20px;
      background: #e2e8f0;
      margin: 0 4px;
    }
  `]
})
export class WorkflowPaperComponent implements AfterViewInit, OnDestroy {
  
  @ViewChild('paperContainer', { static: true }) paperContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('wrapper', { static: true }) wrapper!: ElementRef<HTMLDivElement>;

  @Input() set workflowData(data: Workflow | null) {
    console.log('WorkflowPaperComponent.workflowData - input received', {
      workflowId: data?.id,
      hasGraph: !!this._graph,
      dataExists: !!data,
      laneCount: data?.lanes?.length || 0,
      nodeCount: data?.nodes?.length || 0,
      edgeCount: data?.edges?.length || 0
    });

    // Siempre guardar los datos actuales
    this.currentData = data;

    if (!data) {
      if (this._graph) this._graph.clear();
      return;
    }

    if (!this._graph) {
      console.log('WorkflowPaperComponent.workflowData - graph not initialized yet, data preserved for ngAfterViewInit');
      return;
    }

    this.applyCurrentData();
  }

  private applyCurrentData() {
    if (!this.currentData || !this._graph) return;

    this.runWithoutEmits(() => {
      try {
        console.log('WorkflowPaperComponent.applyCurrentData - starting deserialization and layout');
        this.serializationService.fromBackendWorkflow(this._graph, this.currentData!);
        this.triggerLayout();
        console.log('WorkflowPaperComponent.applyCurrentData - success');
      } catch (error) {
        console.error('WorkflowPaperComponent.applyCurrentData - error', error);
      }
    });
  }


  @Output() elementSelected = new EventEmitter<joint.dia.CellView | null>();
  @Output() workflowChanged = new EventEmitter<Workflow>(); // Para autosave
  @Output() laneClicked = new EventEmitter<{ laneId: string; x: number; y: number }>();
  
  @Input() readOnly: boolean = false;
  @Input() autoFitLanes: boolean = false;


  private _graph!: joint.dia.Graph;
  private paper!: joint.dia.Paper;
  private currentData: Workflow | null = null;
  private resizeObserver!: ResizeObserver;
  private suppressGraphEvents = false;

  /** Expuesto para que componentes padre puedan verificar si el graph ya fue inicializado */
  get graph(): joint.dia.Graph { return this._graph; }
  get getPaper(): joint.dia.Paper { return this.paper; }


  // Zoom y Pan
  public scale = 1;
  private isPanning = false;
  private lastX = 0;
  private lastY = 0;
  private translateX = 0;
  private translateY = 0;

  constructor(
    private paperService: JointjsPaperService,
    private layoutService: LaneLayoutService,
    private serializationService: WorkflowSerializationService
  ) {}

  ngAfterViewInit(): void {
    const rect = this.wrapper.nativeElement.getBoundingClientRect();
    
    console.log('WorkflowPaperComponent.ngAfterViewInit - initializing paper', {
      containerWidth: rect.width,
      containerHeight: rect.height
    });
    
    // Inicializar Motor
    const setup = this.paperService.initializePaper({
      containerId: this.paperContainer.nativeElement,
      width: rect.width || 1200,
      height: rect.height || 800
    });
    
    this._graph = setup.graph;
    this.paper = setup.paper;

    console.log('WorkflowPaperComponent.ngAfterViewInit - paper initialized successfully', {
      graphId: this._graph?.id,
      paperDimensions: { width: this.paper.options.width, height: this.paper.options.height }
    });

    // Aplicar datos diferidos si existen
    if (this.currentData) {
      console.log('WorkflowPaperComponent.ngAfterViewInit - applying deferred data');
      this.applyCurrentData();
    }


    // Observar Cambios del Contenedor (Resize)
    this.resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        const cr = entry.contentRect;
        console.log('WorkflowPaperComponent.ngAfterViewInit.resizeObserver - container resized', {
          newWidth: cr.width,
          newHeight: cr.height
        });
        this.paper.setDimensions(cr.width, cr.height);
        this.triggerLayout(cr.width, cr.height);
      }
    });
    this.resizeObserver.observe(this.wrapper.nativeElement);

    // Binds de JointJS Events
    this.bindPaperEvents();
  }

  private bindPaperEvents(): void {
    this.paper.on('blank:pointerdown', (evt: joint.dia.Event, x: number, y: number) => {
      this.elementSelected.emit(null);
      this.isPanning = true;
      this.lastX = evt.clientX || 0;
      this.lastY = evt.clientY || 0;
    });

    this.paper.on('element:pointerdown', (cellView: joint.dia.CellView, evt: joint.dia.Event) => {
      // Si hacemos click en una calle, permitir el panning
      if (cellView.model.get('type') === 'app.Lane') {
        this.isPanning = true;
        this.lastX = evt.clientX || 0;
        this.lastY = evt.clientY || 0;
      }
    });

    // Panning Global (fuera de blank:pointermove para que sea más fluido)
    this.wrapper.nativeElement.addEventListener('mousemove', (evt: MouseEvent) => {
      if (!this.isPanning) return;

      const dx = evt.clientX - this.lastX;
      const dy = evt.clientY - this.lastY;

      this.translateX += dx;
      this.translateY += dy;
      this.paper.translate(this.translateX, this.translateY);

      this.lastX = evt.clientX;
      this.lastY = evt.clientY;
    });

    window.addEventListener('mouseup', () => {
      this.isPanning = false;
    });

    // Zoom con Rueda
    this.wrapper.nativeElement.addEventListener('wheel', (evt: WheelEvent) => {
      evt.preventDefault();
      
      const delta = evt.deltaY > 0 ? -0.1 : 0.1;
      const newScale = Math.max(0.2, Math.min(3, this.scale + delta));
      
      if (newScale !== this.scale) {
        // Zoom centrado en el mouse
        const rect = this.wrapper.nativeElement.getBoundingClientRect();
        const mouseX = evt.clientX - rect.left;
        const mouseY = evt.clientY - rect.top;

        // Calcular posición en el modelo antes del zoom
        const localX = (mouseX - this.translateX) / this.scale;
        const localY = (mouseY - this.translateY) / this.scale;

        this.scale = newScale;
        
        // Ajustar traslación para que el punto bajo el mouse se mantenga
        this.translateX = mouseX - localX * this.scale;
        this.translateY = mouseY - localY * this.scale;

        this.paper.scale(this.scale, this.scale);
        this.paper.translate(this.translateX, this.translateY);
      }
    }, { passive: false });

    this.paper.on('element:pointerdown', (cellView: joint.dia.CellView, _evt: unknown, x: number, y: number) => {
      this.elementSelected.emit(cellView);

      if (cellView.model.get('type') === 'app.Lane') {
        this.laneClicked.emit({ laneId: String(cellView.model.id), x: Number(x), y: Number(y) });
      }
    });

    this.paper.on('link:pointerdown', (cellView: joint.dia.CellView) => {
      this.elementSelected.emit(cellView);
    });

    // Detectar cuando el usuario finaliza de mover un nodo
    this.paper.on('element:pointerup', (cellView: joint.dia.CellView) => {
      this.emitChanges();
    });

    this._graph.on('add remove', () => {
      this.triggerLayout();
      if (this.suppressGraphEvents) {
        return;
      }
      this.emitChanges();
    });

    this._graph.on('change:position', (cell: joint.dia.Cell) => {
      if (cell.get('type') === 'app.Lane') {
        this.triggerLayout();
      }
    });

    this._graph.on('change:attrs change:labels', () => {
      if (this.suppressGraphEvents) {
        return;
      }
      this.emitChanges();
    }, { passive: false });
  }

  public zoomIn(): void {
    const newScale = Math.min(3, this.scale + 0.2);
    this.applyZoom(newScale);
  }

  public zoomOut(): void {
    const newScale = Math.max(0.2, this.scale - 0.2);
    this.applyZoom(newScale);
  }

  private applyZoom(newScale: number): void {
    if (newScale === this.scale) return;

    const rect = this.wrapper.nativeElement.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const localX = (centerX - this.translateX) / this.scale;
    const localY = (centerY - this.translateY) / this.scale;

    this.scale = newScale;
    this.translateX = centerX - localX * this.scale;
    this.translateY = centerY - localY * this.scale;

    this.paper.scale(this.scale, this.scale);
    this.paper.translate(this.translateX, this.translateY);
  }

  private triggerLayout(w?: number, h?: number): void {
    if (!this._graph) {
      console.warn('WorkflowPaperComponent.triggerLayout - graph not initialized');
      return;
    }

    if (!this.currentData) {
      console.warn('WorkflowPaperComponent.triggerLayout - current data not set');
      return;
    }

    const lanes = Array.isArray(this.currentData.lanes) ? this.currentData.lanes : [];
    if (lanes.length === 0) {
      console.log('WorkflowPaperComponent.triggerLayout - no lanes to layout');
      return;
    }
    
    const paperWidth = w || (this.paper.options.width as number) || 1200;
    const paperHeight = h || (this.paper.options.height as number) || 800;

    if (!paperWidth || !paperHeight) {
      console.warn('WorkflowPaperComponent.triggerLayout - invalid paper dimensions', { paperWidth, paperHeight });
      return;
    }

    try {
      console.log('WorkflowPaperComponent.triggerLayout - starting layout', {
        paperWidth,
        paperHeight,
        laneCount: lanes.length
      });
      
      this.layoutService.recalculateLaneLayout(
        this._graph,
        lanes,
        paperWidth,
        paperHeight,
        this.autoFitLanes
      );

      
      // Auto-fit inicial si es la primera vez que se carga
      setTimeout(() => this.fitToContent(), 100);

      console.log('WorkflowPaperComponent.triggerLayout - layout completed successfully');
    } catch (error) {
      console.error('WorkflowPaperComponent.triggerLayout - error during layout calculation', error);
    }
  }

  private emitChanges(): void {
    if (this.suppressGraphEvents) {
      return;
    }

    if (this.currentData && this._graph) {
      const updated = this.serializationService.toBackendWorkflow(this._graph, this.currentData);
      this.workflowChanged.emit(updated);
    }
  }

  private runWithoutEmits(action: () => void): void {
    this.suppressGraphEvents = true;
    try {
      action();
    } finally {
      this.suppressGraphEvents = false;
    }
  }

  /**
   * Fuerza la aplicación de cambios remotos sin emitir eventos internos
   */
  public applyRemoteWorkflow(workflow: Workflow): void {
    console.log('WorkflowPaperComponent.applyRemoteWorkflow - applying remote changes', {
      laneCount: workflow?.lanes?.length || 0,
      nodeCount: workflow?.nodes?.length || 0
    });

    if (!workflow || !this._graph) {
      console.warn('WorkflowPaperComponent.applyRemoteWorkflow - invalid workflow or graph not initialized');
      return;
    }

    this.currentData = workflow;
    this.runWithoutEmits(() => {
      try {
        this.serializationService.fromBackendWorkflow(this._graph, workflow);
        this.triggerLayout();
        console.log('WorkflowPaperComponent.applyRemoteWorkflow - remote changes applied successfully');
      } catch (error) {
        console.error('WorkflowPaperComponent.applyRemoteWorkflow - error applying remote changes', error);
      }
    });
  }

  /**
   * Ajusta el zoom y la posición para que todo el contenido sea visible
   */
  public fitToContent(): void {
    if (!this.paper || !this._graph) return;

    // Obtener el área ocupada por todos los elementos
    const contentBBox = this._graph.getBBox();
    if (!contentBBox || contentBBox.width === 0 || contentBBox.height === 0) return;

    const rect = this.wrapper.nativeElement.getBoundingClientRect();
    const padding = 40;
    
    const availableWidth = rect.width - (padding * 2);
    const availableHeight = rect.height - (padding * 2);

    // Calcular escala necesaria para encajar
    const scaleX = availableWidth / contentBBox.width;
    const scaleY = availableHeight / contentBBox.height;
    const newScale = Math.max(0.2, Math.min(1, Math.min(scaleX, scaleY)));

    this.scale = newScale;
    
    // Centrar
    this.translateX = (rect.width - contentBBox.width * this.scale) / 2 - contentBBox.x * this.scale;
    this.translateY = (rect.height - contentBBox.height * this.scale) / 2 - contentBBox.y * this.scale;

    this.paper.scale(this.scale, this.scale);
    this.paper.translate(this.translateX, this.translateY);
  }

  ngOnDestroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    this.paperService.destroy();
  }
}
