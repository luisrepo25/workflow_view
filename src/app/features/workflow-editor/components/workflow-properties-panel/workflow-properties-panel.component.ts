import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  DecisionContextField,
  DecisionRulesMode,
  DecisionRulesPatchRequest,
  DecisionRulesSimulateResponse,
  DecisionRulesValidationResult,
  DecisionRule,
  ConditionOperator,
  NodeForm,
  FormField
} from '../../../../shared/models/workflow.model';
import { UserListItem } from '../../../../core/services/workflow.service';

@Component({
  selector: 'app-workflow-properties-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, NgFor, NgIf],
  template: `
    <div class="panel-container">
      <div class="header">
        <h4>Propiedades</h4>
      </div>
      
      <div class="content" *ngIf="selectionType; else noSelection">
        <div class="prop-group">
          <label>Elemento Seleccionado</label>
          <div><span class="tag">{{ selectionType }}</span></div>
        </div>

        <div class="prop-group">
          <label>Identificador</label>
          <input type="text" [value]="selectionId" disabled class="disabled-input">
        </div>

        <div class="prop-group" *ngIf="selectionName !== undefined">
          <label>Nombre / Etiqueta</label>
          <input type="text" 
                 [value]="selectionName" 
                 (input)="onNameChange($event)">
        </div>

        <!-- Asignacion de Funcionario -->
        <div class="prop-group" *ngIf="selectionType === 'Nodo' && nodeType === 'actividad'">
          <label>Asignación de Funcionario</label>
          <div class="form-item">
            <select [ngModel]="nodeResponsableTipo || 'departamento'" (ngModelChange)="onResponsableTipoChange($event)">
              <option value="departamento">Por departamento</option>
              <option value="usuario">Funcionario específico</option>
            </select>

            <ng-container *ngIf="(nodeResponsableTipo || 'departamento') === 'usuario'">
              <ng-container *ngIf="filteredFuncionarios.length > 0; else noFuncionarios">
                <select [ngModel]="nodeResponsableUsuarioId || ''" (ngModelChange)="onResponsableUsuarioSelectChange($event)" class="mt-2">
                  <option value="">-- Selecciona --</option>
                  <option *ngFor="let u of filteredFuncionarios" [value]="u.id">{{ u.nombre }} &lt;{{ u.email }}&gt;</option>
                </select>
              </ng-container>
              <ng-template #noFuncionarios>
                <p class="no-funcionarios-hint">{{ loadingFuncionarios ? 'Cargando...' : 'Sin funcionarios. Ingresa el ID:' }}</p>
                <input type="text" placeholder="ObjectId (24 hex)" [ngModel]="nodeResponsableUsuarioId || ''" (ngModelChange)="onResponsableUsuarioIdChange($event)">
              </ng-template>
            </ng-container>

            <p class="field-error" *ngIf="getResponsableError() as responsableError">{{ responsableError }}</p>
          </div>
        </div>

        <!-- Formulario de Actividad -->
        <div class="prop-group" *ngIf="selectionType === 'Nodo' && nodeType === 'actividad'">
          <label>Formulario de Actividad</label>
          <div class="form-list">
            <div class="form-item-box" *ngFor="let field of formFields(); trackBy: trackByFieldId">
              <input type="text" placeholder="Etiqueta del campo" [ngModel]="field.label || field.nombre || ''" (ngModelChange)="updateFieldModel(field.id, 'label', $event)">
              
              <div class="field-actions">
                <select [ngModel]="field.tipo" (ngModelChange)="updateFieldModel(field.id, 'tipo', $event)">
                  <option value="text">Texto</option>
                  <option value="textarea">Área de texto</option>
                  <option value="number">Número</option>
                  <option value="date">Fecha</option>
                  <option value="bool">Booleano</option>
                  <option value="select">Selección</option>
                  <option value="file">Archivo</option>
                </select>

                <label class="checkbox-label">
                  <input type="checkbox" [ngModel]="field.required" (ngModelChange)="updateFieldModel(field.id, 'required', $event)">
                  Req.
                </label>

                <button class="btn-icon" title="Eliminar" (click)="removeField(field.id)">✕</button>
              </div>

              <input type="text" placeholder="Opciones separadas por comas" *ngIf="field.tipo === 'select'" [ngModel]="field.options?.join(', ') || field.opciones?.join(', ') || ''" (ngModelChange)="updateFieldModel(field.id, 'options', $event)" class="mt-2">
              <p class="field-error" *ngIf="getFieldError(field)">{{ getFieldError(field) }}</p>
            </div>
            
            <button class="btn-sm btn-primary mt-2" (click)="addFormField()">+ Agregar Campo</button>
          </div>
        </div>

        <!-- Reglas de Decision -->
        <div class="prop-group" *ngIf="selectionType === 'Nodo' && nodeType === 'decision'">
          <label>Reglas de Decisión</label>
          
          <div class="form-item">
            <span class="sub-label">Modo</span>
            <select [value]="decisionMode" (change)="onDecisionModeChange($event)">
              <option value="binary">Binario (2 reglas)</option>
              <option value="standard">Estándar (con fallback)</option>
            </select>
          </div>

          <div class="form-item" *ngIf="decisionContextFields.length > 0">
            <span class="sub-label">Campos disponibles</span>
            <div class="context-fields">
              <span class="tag-small" *ngFor="let field of decisionContextFields">{{ field.label }}</span>
            </div>
          </div>

          <div class="rule-box" *ngIf="decisionRuleState() as rule">
            <span class="sub-label">Condición</span>
            <select [ngModel]="rule.field || ''" (ngModelChange)="updateDecisionRuleModel('field', $event)">
              <option value="">Campo...</option>
              <option *ngFor="let field of availableContextFields" [value]="field.fieldId">{{ field.label }}</option>
            </select>
            <select [ngModel]="rule.operator || ''" (ngModelChange)="updateDecisionRuleModel('operator', $event)">
              <option value="">Operador...</option>
              <option *ngFor="let op of operatorOptions" [value]="op.value">{{ op.label }}</option>
            </select>
            <input type="text" placeholder="Valor" [ngModel]="rule.value || ''" (ngModelChange)="updateDecisionRuleModel('value', $event)">

            <span class="sub-label mt-3">Destino (Cumple)</span>
            <select [ngModel]="normalizeEntityId(rule.onTrueDestinoNodeId)" (ngModelChange)="onDecisionDestinationChange('onTrueDestinoNodeId', $event)">
              <option value="">{{ getDecisionDestinationPlaceholder(rule.onTrueDestinoNodeId) }}</option>
              <option *ngFor="let option of decisionDestinationOptions" [value]="normalizeEntityId(option.id)">{{ option.name }}</option>
            </select>

            <span class="sub-label mt-3">Destino (No Cumple)</span>
            <select [ngModel]="normalizeEntityId(rule.onFalseDestinoNodeId)" (ngModelChange)="onDecisionDestinationChange('onFalseDestinoNodeId', $event)">
              <option value="">{{ getDecisionDestinationPlaceholder(rule.onFalseDestinoNodeId) }}</option>
              <option *ngFor="let option of decisionDestinationOptions" [value]="normalizeEntityId(option.id)">{{ option.name }}</option>
            </select>
          </div>

          <div class="form-item mt-3">
            <span class="sub-label">Simulación JSON</span>
            <textarea rows="3" [value]="simulationInputJson" (input)="onSimulationInputChange($event)"></textarea>
          </div>

          <div class="actions-grid mt-3">
            <button class="btn-sm" (click)="emitValidateDecisionRules()" [disabled]="decisionBusy">Validar</button>
            <button class="btn-sm" (click)="emitSimulateDecisionRules()" [disabled]="decisionBusy">Simular</button>
            <button class="btn-sm btn-primary full-width" (click)="emitPersistDecisionRules()" [disabled]="decisionBusy">Guardar reglas</button>
          </div>

          <div class="result-box mt-3" *ngIf="decisionValidationResult">
            <p [class.validation-ok]="decisionValidationResult.valid" [class.validation-error]="!decisionValidationResult.valid">
              {{ decisionValidationResult.valid ? '✅ Validación exitosa' : '❌ Validación con errores' }}
            </p>
            <p class="field-error" *ngFor="let error of decisionValidationResult.errors">{{ error }}</p>
          </div>

          <div class="result-box mt-3" *ngIf="decisionSimulationResult">
            <p><strong>Coincide:</strong> {{ decisionSimulationResult.matched ? 'Sí' : 'No' }}</p>
            <p *ngIf="decisionSimulationResult.matchedRule"><strong>Regla:</strong> {{ decisionSimulationResult.matchedRule }}</p>
            <p *ngIf="decisionSimulationResult.destinoNodeId"><strong>Destino:</strong> {{ decisionSimulationResult.destinoNodeId }}</p>
          </div>
        </div>

        <div class="actions">
          <button class="btn-danger-outline" (click)="deleteSelected.emit()">Eliminar Elemento</button>
        </div>
      </div>

      <ng-template #noSelection>
        <div class="empty-state">
          <p>Selecciona una Calle, Nodo o Enlace en el diagrama para ver sus propiedades.</p>
        </div>
      </ng-template>
    </div>
  `,
  styles: [`
    .panel-container {
      width: 100%;
      height: 100%;
      background: #f8fafc;
      border-left: 1px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
    }
    .header {
      padding: 16px 20px;
      background: white;
      border-bottom: 1px solid #e2e8f0;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
      z-index: 10;
    }
    .header h4 { margin: 0; color: #0f172a; font-size: 15px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .content {
      padding: 20px;
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .prop-group {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.02);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .prop-group > label { 
      font-size: 13px; 
      color: #334155; 
      font-weight: 600; 
      margin: 0; 
    }
    .sub-label {
      font-size: 12px;
      color: #64748b;
      font-weight: 500;
      margin-bottom: 4px;
      display: block;
    }
    input, select, textarea { 
      width: 100%; 
      box-sizing: border-box; 
      padding: 8px 12px; 
      border: 1px solid #cbd5e1; 
      border-radius: 6px; 
      font-size: 13px; 
      color: #1e293b;
      background: #f8fafc;
      transition: all 0.2s;
      font-family: inherit;
    }
    input:focus, select:focus, textarea:focus {
      outline: none;
      border-color: #3b82f6;
      background: white;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }
    .disabled-input { 
      background: #f1f5f9 !important; 
      color: #94a3b8 !important; 
      border-color: #e2e8f0 !important;
      cursor: not-allowed;
    }
    .tag {
      display: inline-block;
      padding: 4px 10px;
      background: #eff6ff;
      color: #2563eb;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      border: 1px solid #bfdbfe;
    }
    .tag-small {
      display: inline-block;
      padding: 3px 8px;
      background: #f1f5f9;
      color: #475569;
      border-radius: 4px;
      font-size: 11px;
      margin: 2px;
    }
    .context-fields { display: flex; flex-wrap: wrap; gap: 4px; }
    
    .form-item { display: flex; flex-direction: column; gap: 4px; }
    .form-list { display: flex; flex-direction: column; gap: 12px; }
    
    .form-item-box, .rule-box {
      padding: 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .field-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .field-actions select { flex: 1; min-width: 0; padding: 6px 8px; }
    
    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #475569;
      cursor: pointer;
      white-space: nowrap;
      margin: 0;
    }
    .checkbox-label input {
      width: 16px !important;
      height: 16px !important;
      padding: 0;
      margin: 0;
    }
    
    .mt-2 { margin-top: 8px; }
    .mt-3 { margin-top: 12px; }
    
    .btn-sm, .btn-primary, .btn-danger-outline {
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      border: 1px solid transparent;
      text-align: center;
    }
    .btn-sm {
      background: white;
      border-color: #cbd5e1;
      color: #334155;
    }
    .btn-sm:hover:not(:disabled) { background: #f8fafc; border-color: #94a3b8; }
    .btn-sm:disabled { opacity: 0.6; cursor: not-allowed; }
    
    .btn-primary { background: #3b82f6; color: white; border-color: #2563eb; }
    .btn-primary:hover:not(:disabled) { background: #2563eb; }
    
    .btn-icon {
      background: #fef2f2;
      color: #ef4444;
      border: 1px solid #fecaca;
      border-radius: 6px;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;
      padding: 0;
      font-size: 12px;
      flex-shrink: 0;
    }
    .btn-icon:hover { background: #fee2e2; }
    
    .btn-danger-outline {
      background: transparent;
      color: #ef4444;
      border: 1px solid #fecaca;
      width: 100%;
    }
    .btn-danger-outline:hover { background: #fef2f2; }
    
    .actions-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .full-width { grid-column: 1 / -1; }
    .actions { margin-top: auto; padding-top: 16px; }
    
    .result-box {
      padding: 12px;
      background: #f8fafc;
      border-radius: 6px;
      font-size: 12px;
      border: 1px solid #e2e8f0;
    }
    .result-box p { margin: 0 0 4px; }
    .result-box p:last-child { margin-bottom: 0; }
    .validation-ok { color: #16a34a; font-weight: 500; }
    .validation-error { color: #dc2626; font-weight: 500; }
    
    .field-error { color: #dc2626; font-size: 11px; margin: 4px 0 0; }
    .empty-state {
      padding: 40px 20px;
      text-align: center;
      color: #64748b;
      font-size: 14px;
      line-height: 1.5;
    }
    .no-funcionarios-hint { font-size: 12px; color: #64748b; margin-top: 4px; font-style: italic; }
  `]
})
export class WorkflowPropertiesPanelComponent {
  
  @Input() selectionType: 'Calle' | 'Nodo' | 'Enlace' | null = null;
  @Input() selectionId: string = '';
  @Input() selectionName?: string;
  @Input() nodeType?: string;
  @Input() nodeForm?: NodeForm | null;
  @Input() nodeResponsableTipo?: 'cliente' | 'usuario' | 'departamento';
  @Input() nodeResponsableUsuarioId?: string;
  /** departmentId del nodo actualmente seleccionado (para filtrar funcionarios) */
  @Input() nodeDepartmentId?: string;
  /** Lista completa de funcionarios (rol=Funcionario) cargada por el padre */
  @Input() funcionarios: UserListItem[] = [];
  /** Indica si el padre está cargando la lista de funcionarios */
  @Input() loadingFuncionarios = false;
  @Input() decisionMode: DecisionRulesMode = 'binary';
  @Input() decisionRule: DecisionRule | null = null;
  @Input() decisionContextFields: DecisionContextField[] = [];
  @Input() decisionDestinationOptions: Array<{ id: string; name: string }> = [];
  @Input() decisionValidationResult: DecisionRulesValidationResult | null = null;
  @Input() decisionSimulationResult: DecisionRulesSimulateResponse | null = null;
  @Input() decisionBusy = false;

  @Output() propertyChanged = new EventEmitter<{ key: string, value: any }>();
  @Output() deleteSelected = new EventEmitter<void>();
  @Output() formChanged = new EventEmitter<NodeForm>();
  @Output() decisionRulesChanged = new EventEmitter<DecisionRulesPatchRequest>();
  @Output() decisionRulesPersistRequested = new EventEmitter<DecisionRulesPatchRequest>();
  @Output() decisionRulesValidateRequested = new EventEmitter<DecisionRulesPatchRequest>();
  @Output() decisionRulesSimulateRequested = new EventEmitter<{ payload: DecisionRulesPatchRequest; input: Record<string, unknown> }>();

  public formFields = signal<FormField[]>([]);
  public decisionRuleState = signal<DecisionRule | null>(null);
  public simulationInputJson = '{}';

  /** Funcionarios filtrados por el departamento del nodo seleccionado */
  get filteredFuncionarios(): UserListItem[] {
    const deptId = this.nodeDepartmentId?.trim();
    if (!deptId || !this.funcionarios?.length) {
      return this.funcionarios ?? [];
    }
    return this.funcionarios.filter(u => u.departmentId === deptId);
  }

  public operatorOptions = [
    { value: ConditionOperator.EQUALS, label: 'Igual a (==)' },
    { value: ConditionOperator.NOT_EQUALS, label: 'Distinto de (!=)' },
    { value: ConditionOperator.GREATER_THAN, label: 'Mayor que (>)' },
    { value: ConditionOperator.GREATER_EQUAL_THAN, label: 'Mayor o igual (>=)' },
    { value: ConditionOperator.LESS_THAN, label: 'Menor que (<)' },
    { value: ConditionOperator.LESS_EQUAL_THAN, label: 'Menor o igual (<=)' },
    { value: ConditionOperator.CONTAINS, label: 'Contiene' },
    { value: ConditionOperator.STARTS_WITH, label: 'Empieza con' },
    { value: ConditionOperator.ENDS_WITH, label: 'Termina con' }
  ];

  get availableContextFields(): DecisionContextField[] {
    return this.decisionContextFields.filter(f => f.type !== 'file');
  }

  ngOnInit() {
    if (this.nodeForm) {
      this.formFields.set(this.normalizeFormFields(this.nodeForm.campos || []));
    }
  }

  ngOnChanges() {
    if (this.nodeForm) {
      this.formFields.set(this.normalizeFormFields(this.nodeForm.campos || []));
    } else {
      this.formFields.set([]);
    }

    this.decisionRuleState.set(this.normalizeDecisionRule(this.decisionRule));

    console.log('WorkflowPropertiesPanel.ngOnChanges decision state', {
      decisionRuleInput: this.decisionRule,
      normalizedRule: this.decisionRuleState(),
      destinationOptions: this.decisionDestinationOptions
    });
  }

  onNameChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.propertyChanged.emit({ key: 'name', value: input.value });
  }

  onResponsableTipoChange(value: string): void {
    this.propertyChanged.emit({ key: 'responsableTipo', value });
  }

  onResponsableUsuarioIdChange(value: string): void {
    this.propertyChanged.emit({ key: 'responsableUsuarioId', value });
  }

  onResponsableUsuarioSelectChange(value: string): void {
    this.propertyChanged.emit({ key: 'responsableUsuarioId', value });
  }

  addFormField(): void {
    const newField: FormField = {
      id: 'f' + Date.now(),
      label: 'Nuevo Campo',
      tipo: 'text',
      required: false
    };
    const updated = [...this.formFields(), newField];
    this.formFields.set(updated);
    this.emitFormChange();
  }

  removeField(fieldId: string): void {
    const updated = this.formFields().filter(f => f.id !== fieldId);
    this.formFields.set(updated);
    this.emitFormChange();
  }

  updateField(fieldId: string, key: 'label' | 'tipo' | 'required' | 'options', event: Event): void {
    const input = event.target as HTMLInputElement | HTMLSelectElement;
    let value: any = input.value;
    if (key === 'required') {
      value = (event.target as HTMLInputElement).checked;
    }
    this.updateFieldModel(fieldId, key, value);
  }

  updateFieldModel(fieldId: string, key: 'label' | 'tipo' | 'required' | 'options', rawValue: any): void {
    let value = rawValue;
    if (key === 'options' && typeof rawValue === 'string') {
      value = rawValue.split(',').map(o => o.trim()).filter(o => o);
    }

    const updated = this.formFields().map(f => 
      f.id === fieldId ? { ...f, [key]: value } : f
    );
    this.formFields.set(updated);
    this.emitFormChange();
  }

  trackByFieldId(index: number, field: any): string {
    return field.id || index;
  }

  private normalizeFormFields(fields: FormField[]): FormField[] {
    return (fields || []).map(field => ({
      ...field,
      label: field.label ?? field.nombre ?? '',
      required: field.required ?? field.obligatorio ?? false,
      options: field.options ?? field.opciones ?? []
    }));
  }

  private emitFormChange(): void {
    if (this.nodeForm) {
      this.formChanged.emit({
        ...this.nodeForm,
        campos: this.formFields()
      });
    }
  }

  getFieldError(field: FormField): string | null {
    if (!field.label?.trim()) {
      return 'La etiqueta del campo es obligatoria.';
    }

    if (field.tipo === 'select' && (!field.options || field.options.length === 0)) {
      return 'Un campo select debe tener al menos una opción.';
    }

    return null;
  }

  getResponsableError(): string | null {
    if ((this.nodeResponsableTipo || 'departamento') !== 'usuario') {
      return null;
    }

    const value = (this.nodeResponsableUsuarioId || '').trim();
    if (!value) {
      return 'Selecciona o ingresa el ID del funcionario asignado.';
    }

    // Allow any non-empty string (UUID, 24-hex ObjectId, etc)
    return null;
  }

  onDecisionModeChange(event: Event): void {
    const mode = (event.target as HTMLSelectElement).value as DecisionRulesMode;
    this.decisionMode = mode;
    this.emitDecisionRulesChange();
  }

  updateDecisionRuleModel(key: keyof DecisionRule, rawValue: string): void {
    const value = (key === 'onTrueDestinoNodeId' || key === 'onFalseDestinoNodeId') ? this.normalizeEntityId(rawValue) : rawValue;
    this.decisionRuleState.update(rule => {
      if (!rule) return this.createEmptyDecisionRule();
      return { ...rule, [key]: value };
    });
    this.emitDecisionRulesChange();
  }

  onDecisionDestinationChange(key: 'onTrueDestinoNodeId' | 'onFalseDestinoNodeId', value: string): void {
    this.updateDecisionRuleModel(key, value);
  }

  emitPersistDecisionRules(): void {
    this.decisionRulesPersistRequested.emit(this.buildDecisionPayload());
  }

  emitValidateDecisionRules(): void {
    this.decisionRulesValidateRequested.emit(this.buildDecisionPayload());
  }

  emitSimulateDecisionRules(): void {
    let parsedInput: Record<string, unknown> = {};
    try {
      parsedInput = JSON.parse(this.simulationInputJson || '{}');
    } catch {
      parsedInput = {};
    }

    this.decisionRulesSimulateRequested.emit({ payload: this.buildDecisionPayload(), input: parsedInput });
  }

  onSimulationInputChange(event: Event): void {
    this.simulationInputJson = (event.target as HTMLTextAreaElement).value;
  }

  private emitDecisionRulesChange(): void {
    this.decisionRulesChanged.emit(this.buildDecisionPayload());
  }

  private buildDecisionPayload(): DecisionRulesPatchRequest {
    const rule = this.decisionRuleState() || this.createEmptyDecisionRule();
    return {
      mode: 'binary',
      decisionRule: {
        field: (rule.field || '').trim() || undefined,
        operator: (rule.operator || '').trim() || undefined,
        value: (rule.value || '').trim() || undefined,
        onTrueDestinoNodeId: (rule.onTrueDestinoNodeId || '').trim(),
        onFalseDestinoNodeId: (rule.onFalseDestinoNodeId || '').trim()
      }
    };
  }

  private normalizeDecisionRule(rule: DecisionRule | null): DecisionRule {
    if (!rule) return this.createEmptyDecisionRule();
    return {
      field: String(rule.field ?? '').trim(),
      operator: String(rule.operator ?? '').trim(),
      value: String(rule.value ?? '').trim(),
      onTrueDestinoNodeId: this.normalizeEntityId(rule.onTrueDestinoNodeId ?? ''),
      onFalseDestinoNodeId: this.normalizeEntityId(rule.onFalseDestinoNodeId ?? '')
    };
  }

  normalizeEntityId(value: unknown): string {
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

  getDecisionDestinationPlaceholder(destinationId?: string): string {
    const normalizedId = this.normalizeEntityId(destinationId ?? '');
    if (!normalizedId) {
      return 'Selecciona nodo destino';
    }

    const option = this.decisionDestinationOptions.find(item => this.normalizeEntityId(item.id) === normalizedId);
    return option?.name || 'Selecciona nodo destino';
  }

  private createEmptyDecisionRule(): DecisionRule {
    return {
      field: '',
      operator: '',
      value: '',
      onTrueDestinoNodeId: '',
      onFalseDestinoNodeId: ''
    };
  }
}
