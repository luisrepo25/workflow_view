import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, tap } from 'rxjs';
import { environment } from '../config/environment';

/**
 * Modelo de Departamento de Empresa
 * Los departamentos representan las áreas/calles del workflow
 * Ejemplos: Recursos Humanos, Sistemas, Finanzas, Legal, etc.
 */
export interface Department {
  id: string;
  nombre: string;
  descripcion?: string;
  activo: boolean;
  color?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DepartmentCreateRequest {
  nombre: string;
  descripcion?: string;
  activo?: boolean;
}

/**
 * Servicio de Departamentos de Empresa
 * Responsable de:
 * - Obtener lista de departamentos disponibles del backend
 * - Cachear departamentos para evitar múltiples llamadas
 * - Proporcionar departamentos para crear calles/lanes en workflows
 */
@Injectable({
  providedIn: 'root'
})
export class DepartmentService {
  private readonly http = inject(HttpClient);
  private readonly departmentsUrl = environment.apiUrl + '/departments';

  // Signal para almacenar departamentos cacheados
  private departmentsSignal = signal<Department[]>([]);
  public departments = computed(() => this.departmentsSignal());

  // Signal para estado de carga
  private loadingSignal = signal(false);
  public isLoading = computed(() => this.loadingSignal());

  // Signal para errores
  private errorSignal = signal<string | null>(null);
  public error = computed(() => this.errorSignal());

  /**
   * Obtener lista de departamentos disponibles
   * GET /api/departments
   * 
   * Los departamentos obtenidos se usan para:
   * 1. Crear calles/lanes en el workflow editor
   * 2. Asignar responsables a actividades
   * 3. Filtrar por departamento
   */
  getDepartments() {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.http.get<any[]>(this.departmentsUrl).pipe(
      tap(
        departments => {
          console.log('DepartmentService.getDepartments - raw response', departments);
          const normalizedDepartments = (departments || []).map(d => this.normalizeDepartment(d));
          console.log('DepartmentService.getDepartments - normalized departments', normalizedDepartments);
          // Filtrar solo departamentos activos
          const activeDepartments = normalizedDepartments.filter(d => d.activo !== false);
          console.log('DepartmentService.getDepartments - active departments', activeDepartments);
          this.departmentsSignal.set(activeDepartments);
          this.loadingSignal.set(false);
        },
        error => {
          console.error('DepartmentService.getDepartments - request error', error);
          this.errorSignal.set(error.message || 'Error cargando departamentos');
          this.loadingSignal.set(false);
        }
      )
    );
  }

  /**
   * Crear un nuevo departamento de empresa
   * POST /api/departments
   */
  createDepartment(payload: DepartmentCreateRequest) {
    this.errorSignal.set(null);

    console.log('DepartmentService.createDepartment - request payload', payload);

    return this.http.post<any>(this.departmentsUrl, payload).pipe(
      map(createdRaw => this.normalizeDepartment(createdRaw)),
      tap(
        created => {
          console.log('DepartmentService.createDepartment - normalized created department', created);
          this.upsertDepartmentCache(created);
        },
        error => {
          console.error('DepartmentService.createDepartment - request error', error);
          this.errorSignal.set(error?.error?.message || error?.message || 'Error creando departamento');
        }
      )
    );
  }

  /**
   * Obtener un departamento específico por ID
   */
  getDepartmentById(departmentId: string): Department | undefined {
    return this.departments().find(d => d.id === departmentId);
  }

  /**
   * Obtener departamentos cacheados sin hacer llamada HTTP
   * Útil cuando ya se han cargado previamente
   */
  getCachedDepartments(): Department[] {
    return this.departments();
  }

  /**
   * Verificar si los departamentos ya están cargados en caché
   */
  hasCachedDepartments(): boolean {
    return this.departments().length > 0;
  }

  /**
   * Limpiar caché de departamentos
   * Usar cuando se actualicen desde otro lugar
   */
  clearCache(): void {
    this.departmentsSignal.set([]);
    this.errorSignal.set(null);
  }

  private upsertDepartmentCache(department: Department): void {
    this.departmentsSignal.update(current => {
      const index = current.findIndex(d => d.id === department.id);
      if (index >= 0) {
        const updated = [...current];
        updated[index] = department;
        return updated;
      }
      return [...current, department];
    });
  }

  private normalizeDepartment(raw: any): Department {
    const resolvedDepartmentId = this.resolveDepartmentId(raw);

    if (!resolvedDepartmentId) {
      console.error('DepartmentService.normalizeDepartment - unresolved department ID from backend payload', {
        rawId: raw?.id,
        rawUnderscoreId: raw?._id,
        rawDepartmentId: raw?.departmentId,
        raw
      });
    }

    const normalized: Department = {
      id: resolvedDepartmentId,
      nombre: String(raw?.nombre ?? ''),
      descripcion: raw?.descripcion,
      activo: raw?.activo !== false,
      color: raw?.color,
      createdAt: raw?.createdAt,
      updatedAt: raw?.updatedAt
    };

    console.log('DepartmentService.normalizeDepartment - raw and normalized', {
      raw,
      resolvedDepartmentId,
      normalized
    });

    return normalized;
  }

  /**
   * Convertir un departamento a un objeto Lane para el workflow
   * Este método facilita la conversión entre modelos
   */
  departmentToLane(department: Department, laneOrder: number): any {
    const fallbackKey = (department.nombre || 'departamento').toLowerCase().replace(/\s+/g, '-');
    const normalizedDepartmentId = this.normalizeDepartmentId(department.id);
    const laneKey = normalizedDepartmentId || fallbackKey;

    return {
      // ID de lane siempre unico para permitir multiples calles del mismo departamento
      id: 'lane-' + laneKey + '-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      nombre: department.nombre,
      responsable: department.nombre,
      orden: laneOrder,
      departmentId: normalizedDepartmentId || undefined,
      color: department.color || this.generateColorFromId(laneKey),
      descripcion: department.descripcion
    };
  }

  /**
   * Generar color para departamento basado en su ID
   * Asegura que cada departamento tenga un color consistente
   */
  private generateColorFromId(id: string): string {
    // Lista de colores profesionales para departamentos
    const colors = [
      '#3B82F6', // Azul
      '#10B981', // Verde
      '#F59E0B', // Ámbar
      '#EF4444', // Rojo
      '#8B5CF6', // Púrpura
      '#EC4899', // Rosa
      '#06B6D4', // Cyan
      '#6366F1', // Índigo
    ];

    // Usar el hash del ID para determinar el color de forma consistente
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash) + id.charCodeAt(i);
      hash = hash & hash; // Convertir a int32
    }

    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }

  private normalizeDepartmentId(rawId: unknown): string {
    if (rawId === null || rawId === undefined) {
      return '';
    }

    if (typeof rawId === 'string') {
      return rawId.trim();
    }

    if (typeof rawId === 'object') {
      const candidate = (rawId as any).$oid ?? (rawId as any).oid ?? (rawId as any).id ?? (rawId as any).value;
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }

    const normalized = String(rawId).trim();
    return normalized === '[object Object]' ? '' : normalized;
  }

  private resolveDepartmentId(raw: any): string {
    const candidates = [
      raw?.id,
      raw?._id,
      raw?.departmentId,
      raw?.departamentoId,
      raw?.ID,
      raw?.Id
    ];

    for (const candidate of candidates) {
      const normalized = this.normalizeDepartmentId(candidate);
      if (normalized) {
        return normalized;
      }
    }

    return '';
  }

}
