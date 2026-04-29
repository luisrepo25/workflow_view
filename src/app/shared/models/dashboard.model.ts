export interface BottleneckDto {
  nodeId: string;
  nodeName: string;
  averageTimeMinutos: number;
  pendingCount: number;
}

export interface DashboardMetricsResponse {
  totalTramites: number;
  tramitesActivos: number;
  tramitesCompletados: number;
  tiempoMedioResolucionMinutos: number;
  actividadesPendientesTotales: number;
  tasaRechazoPorcentual: number;
  tramitesPorWorkflowNombre: Record<string, number>;
  cuellosDeBotella: BottleneckDto[];
  tramitesPorEstado: Record<string, number>;
  tramitesPorDepartamento: Record<string, number>;
}
