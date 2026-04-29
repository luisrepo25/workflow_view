export type WorkflowEstado = 'borrador' | 'activo' | 'inactivo';

export interface Workflow {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  estado: WorkflowEstado;
  lanes: Lane[];
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  enEdicionPor?: string;
}

export interface Lane {
  id: string;
  nombre: string;
  responsable: string;
  orden: number;
  departmentId: string;
  descripcion?: string;
  color?: string;
}

export type NodeTipo =
  | 'inicio'
  | 'actividad'
  | 'decision'
  | 'paralelo_inicio'
  | 'paralelo_fin'
  | 'fin';

export interface WorkflowNode {
  id: string;
  tipo: NodeTipo;
  nombre: string;
  descripcion?: string;
  laneId: string;
  departmentId?: string;
  responsableTipo?: 'cliente' | 'usuario' | 'departamento';
  responsableUsuarioId?: string;
  responsableRole?: string;
  slaMinutos?: number;
  posicionX: number;
  posicionY: number;
  ancho?: number;
  alto?: number;
  form?: NodeForm;
  decisionRule?: DecisionRule;
  // Backward compatibility: deprecated fields
  x?: number;
  y?: number;
}

export interface WorkflowEdge {
  id?: string;
  fromNodeId: string;
  toNodeId: string;
  label?: string;
  tipo?: 'secuencial' | 'iterativo' | 'paralelo';
}

export interface NodeForm {
  titulo: string;
  descripcion?: string;
  campos: FormField[];
  // Compatibilidad temporal con datos legacy ya almacenados
  id?: string;
  nodeId?: string;
  nombre?: string;
}

export interface FormField {
  id: string;
  label: string;
  tipo: 'text' | 'textarea' | 'number' | 'date' | 'bool' | 'select' | 'file';
  required: boolean;
  options?: string[];
  placeholder?: string;
  // Compatibilidad temporal con datos legacy ya almacenados
  nombre?: string;
  obligatorio?: boolean;
  opciones?: string[];
  orden?: number;
}

export enum ConditionOperator {
  EQUALS = 'EQUALS',
  NOT_EQUALS = 'NOT_EQUALS',
  GREATER_THAN = 'GREATER_THAN',
  GREATER_EQUAL_THAN = 'GREATER_EQUAL_THAN',
  LESS_THAN = 'LESS_THAN',
  LESS_EQUAL_THAN = 'LESS_EQUAL_THAN',
  CONTAINS = 'CONTAINS',
  STARTS_WITH = 'STARTS_WITH',
  ENDS_WITH = 'ENDS_WITH'
}

export interface DecisionRule {
  field?: string;
  operator?: ConditionOperator | string;
  value?: string;
  onTrueDestinoNodeId?: string;
  onFalseDestinoNodeId?: string;
}

export type DecisionRulesMode = 'binary' | 'standard';

export interface DecisionContextField {
  fieldId: string;
  label: string;
  type: string;
  sourceNodeId: string;
}

export interface DecisionContextResponse {
  decisionNodeId: string;
  incomingNodeIds: string[];
  fields: DecisionContextField[];
  operatorsByType: Record<string, string[]>;
}

export interface DecisionRulesPatchRequest {
  mode: DecisionRulesMode;
  decisionRule: DecisionRule;
}

export interface DecisionRulesPatchResponse {
  nodeId: string;
  updatedAt: string;
  decisionRule: DecisionRule;
}

export interface DecisionRulesValidateRequest {
  mode: DecisionRulesMode;
  decisionRule: DecisionRule;
}

export interface DecisionRulesValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface DecisionRulesSimulateRequest {
  mode: DecisionRulesMode;
  input: Record<string, unknown>;
  decisionRule: DecisionRule;
}

export interface DecisionRulesSimulateResponse {
  matched: boolean;
  matchedRule?: string;
  destinoNodeId?: string;
  trace: string[];
}

export interface WorkflowListItem {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  estado: WorkflowEstado;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  enEdicionPor?: string;
}

export interface WorkflowValidationResponse {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface WorkflowChangeMessage {
  id?: string;
  messageId?: string;
  workflowId: string;
  userId: string;
  userName: string;
  nodeId?: string;
  edgeId?: string;
  laneId?: string;
  action:
    | 'node_added'
    | 'node_updated'
    | 'node_deleted'
    | 'edge_added'
    | 'edge_deleted'
    | 'lane_added'
    | 'lane_updated'
    | 'lane_deleted'
    | 'user_connected'
    | 'user_disconnected'
    | 'selection_updated'
    | 'error';
  data?: any;
  timestamp: number;
  message?: string;
  status?: string;
}

