import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  signal,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Workflow } from '../../../../shared/models/workflow.model';
import { WorkflowAIService } from '../../../../core/services/workflow-ai.service';
import { WorkflowEditorService } from '../../services/workflow-editor.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-workflow-ai-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ai-compact-card">
      <!-- Input Section -->
      <div class="ai-state-input" *ngIf="!proposedWorkflow()">
        <div class="ai-header-inline">
          <div class="ai-sparkle-icon"></div>
          <span class="ai-title-inline">Asistente IA</span>
        </div>

        <div class="ai-chat-box">
          <textarea
            class="ai-chat-input"
            [ngModel]="userInstruction()"
            (ngModelChange)="userInstruction.set($event)"
            [disabled]="loading()"
            placeholder="Ej: Agrega una revisión legal antes del fin..."
            rows="2"
            (keydown.enter)="onEnterPress($event)">
          </textarea>
          
          <button
            class="ai-chat-submit"
            (click)="onSendToAI()"
            [disabled]="loading() || !userInstruction().trim()"
            title="Enviar a IA">
            <svg *ngIf="!loading()" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="send-icon">
              <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
            </svg>
            <div *ngIf="loading()" class="spinner"></div>
          </button>
        </div>

        <div class="ai-error-toast" *ngIf="error()">
          <span>⚠️ {{ error() }}</span>
        </div>
      </div>

      <!-- Proposal Section -->
      <div class="ai-state-proposal" *ngIf="proposedWorkflow()">
        <div class="ai-header-inline">
          <div class="ai-sparkle-icon">✨</div>
          <span class="ai-title-inline">Propuesta lista</span>
        </div>
        
        <div class="ai-proposal-body">
          <p class="ai-proposal-desc">{{ proposedWorkflow()?.descripcion || 'La IA ha generado una versión actualizada de tu flujo.' }}</p>
          
          <div class="ai-stats-row">
            <span class="ai-stat-badge" title="Calles">🛣️ {{ proposedWorkflow()?.lanes?.length || 0 }}</span>
            <span class="ai-stat-badge" title="Nodos">📦 {{ proposedWorkflow()?.nodes?.length || 0 }}</span>
            <span class="ai-stat-badge" title="Relaciones">🔗 {{ proposedWorkflow()?.edges?.length || 0 }}</span>
          </div>
        </div>

        <div class="ai-proposal-actions">
          <button class="ai-btn-ghost" (click)="onDeclineProposal()" [disabled]="loading()">Descartar</button>
          <button class="ai-btn-primary" (click)="onAcceptProposal()" [disabled]="loading()">Aplicar</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .ai-compact-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 12px 16px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
      display: flex;
      flex-direction: column;
      gap: 12px;
      transition: all 0.2s ease;
    }

    .ai-header-inline {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .ai-sparkle-icon {
      font-size: 16px;
      animation: pulse 2s infinite;
    }

    .ai-title-inline {
      font-size: 13px;
      font-weight: 600;
      color: #0f172a;
      letter-spacing: -0.01em;
    }

    .ai-chat-box {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 16px;
      padding: 6px 6px 6px 14px;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .ai-chat-box:focus-within {
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      background: #ffffff;
    }

    .ai-chat-input {
      flex: 1;
      border: none;
      background: transparent;
      padding: 6px 0;
      font-size: 13px;
      color: #1e293b;
      font-family: inherit;
      resize: none;
      min-height: 20px;
      line-height: 1.4;
      outline: none;
    }

    .ai-chat-input::placeholder {
      color: #94a3b8;
    }

    .ai-chat-submit {
      flex-shrink: 0;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: none;
      background: #3b82f6;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;
    }

    .ai-chat-submit:hover:not(:disabled) {
      background: #2563eb;
      transform: scale(1.05);
    }

    .ai-chat-submit:disabled {
      background: #cbd5e1;
      cursor: not-allowed;
    }

    .send-icon {
      width: 16px;
      height: 16px;
    }

    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top-color: white;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }

    .ai-error-toast {
      font-size: 12px;
      color: #dc2626;
      background: #fef2f2;
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px solid #fecaca;
      display: flex;
      align-items: center;
    }

    .ai-proposal-body {
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .ai-proposal-desc {
      margin: 0;
      font-size: 13px;
      color: #334155;
      line-height: 1.5;
    }

    .ai-stats-row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .ai-stat-badge {
      font-size: 11px;
      font-weight: 600;
      color: #475569;
      background: #e2e8f0;
      padding: 4px 8px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .ai-proposal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 4px;
    }

    .ai-btn-ghost, .ai-btn-primary {
      padding: 6px 14px;
      font-size: 12px;
      font-weight: 600;
      border-radius: 16px;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }

    .ai-btn-ghost {
      background: transparent;
      color: #64748b;
    }

    .ai-btn-ghost:hover:not(:disabled) {
      background: #f1f5f9;
      color: #0f172a;
    }

    .ai-btn-primary {
      background: #10b981;
      color: white;
    }

    .ai-btn-primary:hover:not(:disabled) {
      background: #059669;
      box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
    }
    
    .ai-btn-primary:disabled, .ai-btn-ghost:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `]
})
export class WorkflowAIEditorComponent {
  @Input() currentWorkflow!: Workflow;
  @Output() proposalPreviewed = new EventEmitter<Workflow>();
  @Output() proposalAccepted = new EventEmitter<Workflow>();
  @Output() proposalDeclined = new EventEmitter<void>();

  private readonly aiService = inject(WorkflowAIService);
  private readonly workflowEditorService = inject(WorkflowEditorService);
  private readonly toastr = inject(ToastrService);

  public userInstruction = signal('');
  public loading = signal(false);
  public error = signal<string | null>(null);
  public proposedWorkflow = signal<Workflow | null>(null);

  public onEnterPress(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (!keyboardEvent.shiftKey) {
      keyboardEvent.preventDefault();
      if (!this.loading() && this.userInstruction().trim()) {
        this.onSendToAI();
      }
    }
  }

  public onSendToAI(): void {
    const instruction = this.userInstruction().trim();
    const latestWorkflow = this.workflowEditorService.workflow() ?? this.currentWorkflow;

    if (!instruction) {
      this.toastr.warning('Por favor ingresa una instrucción para la IA', 'Instrucción requerida');
      return;
    }

    if (!latestWorkflow) {
      this.toastr.error('No hay workflow cargado', 'Error');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    console.log('WorkflowAIEditorComponent.onSendToAI - Sending instruction to AI', {
      instruction,
      workflowId: latestWorkflow.id,
      laneCount: latestWorkflow.lanes?.length || 0,
      nodeCount: latestWorkflow.nodes?.length || 0,
      edgeCount: latestWorkflow.edges?.length || 0
    });

    this.aiService.editWorkflowWithAI(instruction, latestWorkflow).subscribe({
      next: (proposedWorkflow: any) => {
        console.log('WorkflowAIEditorComponent.onSendToAI - Proposal received', {
          lanes: proposedWorkflow.lanes?.length,
          nodes: proposedWorkflow.nodes?.length,
          edges: proposedWorkflow.edges?.length
        });

        const normalizedWorkflow = this.normalizeWorkflowProposal(proposedWorkflow, latestWorkflow);

        this.proposedWorkflow.set(normalizedWorkflow);
        this.loading.set(false);

        try {
          this.proposalPreviewed.emit(normalizedWorkflow);
        } catch (emitError: unknown) {
          console.error('WorkflowAIEditorComponent.onSendToAI - Error emitting preview event', emitError);
          this.error.set('La propuesta fue recibida, pero ocurrió un error al renderizar la vista previa.');
          this.toastr.error('Error al mostrar la vista previa en el diagrama.', 'Vista previa IA');
        }

        this.toastr.success('Propuesta recibida de la IA', 'Éxito');
      },
      error: (err: any) => {
        console.error('WorkflowAIEditorComponent.onSendToAI - Error from AI', err);

        this.loading.set(false);
        const errorMessage =
          err?.error?.message || 
          err?.message || 
          'Error al comunicarse con la IA. Verifica que el servicio esté disponible.';

        this.error.set(errorMessage);
        this.toastr.error(errorMessage, 'Error de IA');
      }
    });
  }

  public onAcceptProposal(): void {
    const proposal = this.proposedWorkflow();

    if (!proposal) {
      this.toastr.error('No hay propuesta para aceptar', 'Error');
      return;
    }

    console.log('WorkflowAIEditorComponent.onAcceptProposal - User accepted proposal');

    try {
      this.proposalAccepted.emit(proposal);
    } catch (emitError: unknown) {
      console.error('WorkflowAIEditorComponent.onAcceptProposal - Error emitting accept event', emitError);
      this.toastr.error('No se pudo aplicar la propuesta de IA.', 'Error');
    } finally {
      this.resetToInputMode();
    }
  }

  public onDeclineProposal(): void {
    console.log('WorkflowAIEditorComponent.onDeclineProposal - User declined proposal');

    this.resetToInputMode();

    try {
      this.proposalDeclined.emit();
    } catch (emitError: unknown) {
      console.error('WorkflowAIEditorComponent.onDeclineProposal - Error emitting decline event', emitError);
    }

    this.toastr.info('Propuesta descartada', 'Edición cancelada');
  }

  private resetToInputMode(): void {
    this.userInstruction.set('');
    this.proposedWorkflow.set(null);
    this.error.set(null);
    this.loading.set(false);
  }

  private normalizeWorkflowProposal(proposedWorkflow: any, baseWorkflow: Workflow): Workflow {
    const existingEdgeIdByKey = new Map<string, string>();

    for (const edge of baseWorkflow.edges || []) {
      const key = this.edgeKey(edge.fromNodeId, edge.toNodeId, edge.label ?? null);
      if (edge.id) {
        existingEdgeIdByKey.set(key, edge.id);
      }
    }

    const normalizedEdges = (proposedWorkflow.edges || []).map((edge: any, index: number) => {
      const fromNodeId = String(edge.fromNodeId ?? '').trim();
      const toNodeId = String(edge.toNodeId ?? '').trim();
      const label = edge.label ?? null;
      const key = this.edgeKey(fromNodeId, toNodeId, label);
      const existingEdgeId = existingEdgeIdByKey.get(key);

      return {
        id: String(edge.id ?? existingEdgeId ?? `ai-edge-${fromNodeId}-${toNodeId}-${index}`),
        fromNodeId,
        toNodeId,
        label,
        tipo: (edge.tipo || 'secuencial') as 'secuencial' | 'iterativo' | 'paralelo'
      };
    });

    return {
      ...baseWorkflow,
      ...proposedWorkflow,
      edges: normalizedEdges
    } as Workflow;
  }

  private edgeKey(fromNodeId: string, toNodeId: string, label: string | null): string {
    return `${String(fromNodeId).trim()}=>${String(toNodeId).trim()}=>${String(label ?? '').trim()}`;
  }
}
