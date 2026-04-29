import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';
import {
  CompleteActivityRequest,
  CreateProcessInstanceRequest,
  HistoryEvent,
  NodeFormDto,
  ProcessActivity,
  ProcessInstance
} from '../../shared/models';
import { environment } from '../config/environment';

interface ProcessActivityApi {
  id?: string;
  actividadId?: string;
  nodeId: string;
  nombre?: string;
  estado: string;
  responsableTipo?: string;
  usuarioId?: string;
  departmentId?: string;
  slaMinutos?: number | null;
  permiteAdjuntos?: boolean;
  formulario?: NodeFormDto | null;
  respuestaFormulario?: Record<string, unknown>;
  fechaInicio?: string;
  fechaFin?: string | null;
}

interface ProcessInstanceApi {
  id: string;
  codigo?: string;
  workflowId: string;
  workflowNombre?: string;
  workflowCodigo?: string;
  clienteId: string;
  clienteNombre?: string;
  estado: ProcessInstance['estado'];
  currentNodeIds: string[];
  actividades?: ProcessActivityApi[];
  historial?: HistoryEvent[];
  datosResumen?: ProcessInstance['datosResumen'];
  createdAt: string;
  updatedAt: string;
  finishedAt?: string | null;
  porcentajeCompletitud?: number;
  workflowSnapshot?: any;
}

@Injectable({
  providedIn: 'root'
})
export class ProcessInstanceService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.processInstancesUrl;

  private readonly processInstancesSignal = signal<ProcessInstance[]>([]);
  processInstances = computed(() => this.processInstancesSignal());

  private readonly selectedProcessSignal = signal<ProcessInstance | null>(null);
  selectedProcess = computed(() => this.selectedProcessSignal());

  private readonly pendingActivitiesSignal = signal<ProcessActivity[]>([]);
  pendingActivities = computed(() => this.pendingActivitiesSignal());

  private readonly historySignal = signal<HistoryEvent[]>([]);
  history = computed(() => this.historySignal());

  private readonly loadingSignal = signal(false);
  isLoading = computed(() => this.loadingSignal());

  private readonly errorSignal = signal<string | null>(null);
  error = computed(() => this.errorSignal());

  listAllProcesses() {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.http.get<ProcessInstanceApi[]>(`${this.apiUrl}/all`).pipe(
      tap({
        next: (items) => {
          this.processInstancesSignal.set(items.map(item => this.mapProcessInstance(item)));
          this.loadingSignal.set(false);
        },
        error: () => {
          this.loadingSignal.set(false);
          this.errorSignal.set('No se pudieron cargar todos los trámites.');
        }
      })
    );
  }

  listMyProcesses() {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.http.get<ProcessInstanceApi[]>(this.apiUrl).pipe(
      tap({
        next: (items) => {
          this.processInstancesSignal.set(items.map(item => this.mapProcessInstance(item)));
          this.loadingSignal.set(false);
        },
        error: () => {
          this.loadingSignal.set(false);
          this.errorSignal.set('No se pudieron cargar los tramites.');
        }
      })
    );
  }

  getProcessById(processInstanceId: string) {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.http.get<ProcessInstanceApi>(`${this.apiUrl}/${processInstanceId}`).pipe(
      tap({
        next: (item) => {
          this.selectedProcessSignal.set(this.mapProcessInstance(item));
          this.loadingSignal.set(false);
        },
        error: () => {
          this.loadingSignal.set(false);
          this.errorSignal.set('No se pudo cargar el tramite seleccionado.');
        }
      })
    );
  }

  createProcessInstance(request: CreateProcessInstanceRequest) {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.http.post<ProcessInstanceApi>(this.apiUrl, request).pipe(
      tap({
        next: (created) => {
          const normalized = this.mapProcessInstance(created);
          this.processInstancesSignal.update(items => [normalized, ...items]);
          this.loadingSignal.set(false);
        },
        error: () => {
          this.loadingSignal.set(false);
          this.errorSignal.set('No se pudo crear el tramite.');
        }
      })
    );
  }

  listPendingActivities() {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.http.get<ProcessInstanceApi[]>(`${this.apiUrl}/activities/pending`).pipe(
      tap({
        next: (items) => {
          const activities = items.flatMap(item => {
            const mapped = this.mapProcessInstance(item);
            return mapped.actividades.map(activity => ({
              ...activity,
              processInstanceId: mapped.id,
              workflowNombre: mapped.workflowNombre,
              workflowCodigo: mapped.workflowCodigo,
              nodeName: activity.nodeName || activity.nodeId
            }));
          });

          this.pendingActivitiesSignal.set(activities);
          this.loadingSignal.set(false);
        },
        error: () => {
          this.loadingSignal.set(false);
          this.errorSignal.set('No se pudieron cargar las actividades pendientes.');
        }
      })
    );
  }

  completeActivity(activityId: string, request: CompleteActivityRequest) {
    const formData = new FormData();
    formData.append('payload', JSON.stringify(request));
    return this.completeActivityRaw(activityId, formData);
  }

  /**
   * Versión multipart completa: acepta FormData pre-construida con partes:
   *   payload      → JSON string de CompleteActivityRequest
   *   files        → binarios (uno por campo file)
   *   fileFieldIds → id del campo file correspondiente (mismo orden que files)
   */
  completeActivityRaw(activityId: string, formData: FormData) {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.http.post<ProcessInstanceApi | null>(`${this.apiUrl}/activities/${activityId}/complete`, formData).pipe(
      tap({
        next: (updatedProcess) => {
          this.loadingSignal.set(false);

          if (!updatedProcess) {
            this.pendingActivitiesSignal.update(items =>
              items.filter(activity => this.getActivityId(activity) !== activityId)
            );
            return;
          }

          const mapped = this.mapProcessInstance(updatedProcess);
          this.upsertProcess(mapped);
          this.pendingActivitiesSignal.update(items =>
            items.filter(activity => this.getActivityId(activity) !== activityId)
          );
        },
        error: () => {
          this.loadingSignal.set(false);
          this.errorSignal.set('No se pudo completar la actividad.');
        }
      })
    );
  }


  getProcessHistory(processInstanceId: string) {
    return this.http.get<HistoryEvent[]>(`${this.apiUrl}/${processInstanceId}/history`).pipe(
      tap(history => this.historySignal.set(history))
    );
  }

  private mapProcessInstance(item: ProcessInstanceApi): ProcessInstance {
    return {
      id: item.id,
      codigo: item.codigo ?? item.id,
      workflowId: item.workflowId,
      workflowNombre: item.workflowNombre,
      workflowCodigo: item.workflowCodigo,
      clienteId: item.clienteId,
      clienteNombre: item.clienteNombre ?? 'Cliente',
      estado: item.estado,
      currentNodeIds: item.currentNodeIds ?? [],
      actividades: (item.actividades ?? []).map(activity => this.mapActivity(activity, item.id)),
      historial: item.historial ?? [],
      datosResumen: item.datosResumen ?? {
        titulo: item.codigo ?? item.id,
        descripcionCliente: 'Tramite en curso',
        ultimaActualizacionVisible: item.updatedAt
      },
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      finishedAt: item.finishedAt ?? undefined,
      porcentajeCompletitud: item.porcentajeCompletitud ?? 0,
      workflowSnapshot: item.workflowSnapshot
    };
  }

  private mapActivity(activity: ProcessActivityApi, processId: string): ProcessActivity {
    return {
      actividadId: activity.id ?? activity.actividadId ?? `${processId}-${activity.nodeId}`,
      nodeId: activity.nodeId,
      nombre: activity.nombre,
      nodeName: activity.nombre || activity.nodeId,
      processInstanceId: processId,
      estado: this.mapActivityStatus(activity.estado),
      responsableTipo: (activity.responsableTipo as ProcessActivity['responsableTipo']) ?? undefined,
      usuarioAsignado: activity.usuarioId ?? '',
      usuarioNombre: 'Sin asignar',
      departmentId: activity.departmentId ?? undefined,
      slaMinutos: activity.slaMinutos ?? undefined,
      permiteAdjuntos: activity.permiteAdjuntos ?? false,
      formulario: activity.formulario ?? null,
      respuestaFormulario: activity.respuestaFormulario ?? {},
      fechaInicio: activity.fechaInicio ?? '',
      fechaFin: activity.fechaFin ?? undefined
    };
  }

  private mapActivityStatus(rawStatus: string): ProcessActivity['estado'] {
    if (rawStatus === 'pendiente' || rawStatus === 'en_ejecucion' || rawStatus === 'completada' || rawStatus === 'rechazada' || rawStatus === 'cancelada') {
      return rawStatus;
    }

    if (rawStatus === 'en_espera' || rawStatus === 'en_curso') {
      return rawStatus;
    }

    return 'pendiente';
  }

  private upsertProcess(process: ProcessInstance): void {
    this.processInstancesSignal.update(items => {
      const index = items.findIndex(item => item.id === process.id);
      if (index === -1) {
        return [process, ...items];
      }

      const updated = [...items];
      updated[index] = process;
      return updated;
    });

    if (this.selectedProcessSignal()?.id === process.id) {
      this.selectedProcessSignal.set(process);
    }
  }

  private getActivityId(activity: ProcessActivity): string {
    return activity.actividadId;
  }
}
