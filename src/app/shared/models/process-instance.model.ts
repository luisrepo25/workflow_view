/**
 * Modelo de Trámites (Process Instances) y Actividades
 */

export type ProcessStatus = 'pendiente' | 'en_proceso' | 'correccion' | 'aprobado' | 'rechazado' | 'finalizado' | 'cancelado';
export type ActivityStatus = 'pendiente' | 'en_ejecucion' | 'completada' | 'rechazada' | 'cancelada' | 'en_espera' | 'en_curso';
export type HistoryEventType =
  | 'tramite_creado'
  | 'actividad_creada'
  | 'actividad_iniciada'
  | 'actividad_completada'
  | 'actividad_rechazada'
  | 'flujo_paralelo_activado'
  | 'join_branch_arrived'
  | 'join_resuelto'
  | 'flujo_iterativo_retorno'
  | 'tramite_aprobado'
  | 'tramite_rechazado'
  | 'tramite_finalizado'
  | 'notificacion_generada';

/**
 * Definición de un campo del formulario de una actividad (espejo de FormFieldDto del backend)
 */
export interface ActivityFormField {
  id: string;
  label: string;
  tipo: 'text' | 'textarea' | 'number' | 'date' | 'bool' | 'select' | 'file';
  required: boolean;
  options?: string[];
  placeholder?: string | null;
}

/**
 * Formulario de una actividad (espejo de NodeFormDto del backend)
 */
export interface NodeFormDto {
  titulo: string;
  descripcion?: string;
  campos: ActivityFormField[];
}

/**
 * Actividad en un Trámite - Tarea asignada a un Funcionario
 */
export interface ProcessActivity {
  actividadId: string;
  id?: string;
  nodeId: string;
  nodeName?: string;
  nombre?: string;
  processInstanceId: string;
  estado: ActivityStatus;
  responsableTipo?: 'cliente' | 'usuario' | 'departamento';
  usuarioAsignado?: string;
  usuarioNombre?: string;
  departmentId?: string;
  departmentName?: string;
  slaMinutos?: number;
  slaVencimiento?: string;
  permiteAdjuntos?: boolean;
  formulario?: NodeFormDto | null;
  respuestaFormulario?: Record<string, any>;
  adjuntos?: ActivityAttachment[];
  observacion?: string;
  fechaInicio?: string;
  fechaFin?: string;
  iteracion?: number;
  workflowNombre?: string;
  workflowCodigo?: string;
}

export interface ActivityAttachment {
  fileId: string;
  nombre: string;
  url: string;
}

export interface HistoryEvent {
  tipo: HistoryEventType;
  nodeId?: string;
  nodeIds?: string[];
  usuarioId: string;
  userName: string;
  detalle: string;
  fecha: string;
  dataAnterior?: Record<string, any>;
  dataNueva?: Record<string, any>;
  ipAddress?: string;
  status?: string;
  errorMessage?: string;
}

/**
 * Resumen visible para el Cliente
 */
export interface SummaryData {
  titulo: string;
  descripcionCliente: string;
  ultimaActualizacionVisible: string;
}

/**
 * Trámite - Instancia ejecutable de un Workflow
 */
export interface ProcessInstance {
  id: string;
  codigo?: string; // TRM-2026-00001
  workflowId: string;
  workflowNombre?: string;
  workflowCodigo?: string;
  clienteId: string;
  clienteNombre?: string;
  estado: ProcessStatus;
  currentNodeIds: string[];
  currentActivityId?: string;
  actividades: ProcessActivity[];
  historial: HistoryEvent[];
  datosResumen?: SummaryData;
  porcentajeCompletitud?: number; // Calculado
  workflowSnapshot?: any; // WorkflowSnapshot
  createdAt: string;
  updatedAt: string;
  finishedAt?: string;
}

export interface ProcessInstanceSummary {
  id: string;
  codigo: string;
  workflowNombre: string;
  estado: ProcessStatus;
  porcentajeCompletitud: number;
  actividadActual?: string;
  ultimaActualización: string;
  proximoVencimiento?: string;
}

export interface CreateProcessInstanceRequest {
  workflowId: string;
  clienteId: string;
  datosIniciales?: Record<string, any>;
}

export interface CompleteActivityRequest {
  respuestaFormulario: Record<string, any>;
  comentarios?: string;
}

/**
 * Estados de una actividad EN UN TRÁMITE (no confundir con ActivityStatus del backend)
 */
export const ActivityStateInTramite = {
  EN_ESPERA: 'en_espera',
  EN_CURSO: 'en_curso',
  COMPLETADA: 'completada'
} as const;
