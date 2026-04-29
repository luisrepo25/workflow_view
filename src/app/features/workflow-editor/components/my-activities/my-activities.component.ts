import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProcessInstanceService } from '../../../../core/services/process-instance.service';
import { WorkflowService, UserListItem } from '../../../../core/services/workflow.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ActivityFormField, ProcessActivity, ProcessInstance, WorkflowListItem } from '../../../../shared/models';
import { Workflow } from '../../../../shared/models/workflow.model';
import { animate, style, transition, trigger } from '@angular/animations';
import { WorkflowPaperComponent } from '../workflow-paper/workflow-paper.component';


type ViewMode = 'CASES' | 'MY_ACTIVITIES' | 'DETAIL' | 'CREATE';

@Component({
  selector: 'app-my-activities',
  standalone: true,
  imports: [CommonModule, FormsModule, WorkflowPaperComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ],
  template: `
    <section class="page-container">
      <!-- Navbar interna / Tabs -->
      <nav class="internal-nav">
        <div class="nav-links">
          <button [class.active]="viewMode() === 'CASES'" (click)="setView('CASES')">
            <span class="svg-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
            </span> 
            Todos los Trámites
          </button>
          <button [class.active]="viewMode() === 'MY_ACTIVITIES'" (click)="setView('MY_ACTIVITIES')">
            <span class="svg-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>
            </span> 
            Mis Tareas Pendientes
            <span class="count-badge" *ngIf="pendingActivities().length">{{ pendingActivities().length }}</span>
          </button>
        </div>
        
        <button class="create-btn" (click)="setView('CREATE')">
          <span class="svg-icon white">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </span> 
          Nuevo Trámite
        </button>
      </nav>

      <!-- Contenido principal -->
      <main class="content-area" [ngSwitch]="viewMode()" @fadeIn>
        
        <!-- LISTA DE TODOS LOS TRÁMITES -->
        <div *ngSwitchCase="'CASES'" class="view-section">
          <header class="section-header">
            <div>
              <h1>Trámites en Curso</h1>
              <p>Seguimiento global de todos los procesos de la plataforma.</p>
            </div>
            <button class="secondary-btn" (click)="loadAllCases()" [disabled]="processService.isLoading()">
              <span class="svg-icon mini">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
              </span>
              Actualizar
            </button>
          </header>

          <div class="search-bar">
            <div class="search-input-wrapper">
              <span class="search-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              </span>
              <input type="text" placeholder="Buscar por código o cliente..." [(ngModel)]="searchQuery">
            </div>
          </div>

          <div class="grid-container" *ngIf="!processService.isLoading() || allCases().length > 0; else loadingState">
            <div class="case-card" *ngFor="let item of filteredCases()" (click)="viewDetail(item)">
              <div class="card-status" [attr.data-status]="item.estado"></div>
              <div class="card-content">
                <div class="card-header">
                  <span class="case-code">{{ item.codigo || item.id.substring(0,8) }}</span>
                  <span class="status-badge" [attr.data-status]="item.estado">{{ item.estado | uppercase }}</span>
                </div>
                <h3 class="workflow-name">{{ item.workflowNombre || 'Workflow Desconocido' }}</h3>
                <div class="card-footer">
                  <div class="client-info">
                    <span class="label">Cliente:</span>
                    <span class="value">{{ item.clienteNombre }}</span>
                  </div>
                  <div class="date-info">
                    <span>{{ item.createdAt | date:'dd/MM/yyyy HH:mm' }}</span>
                  </div>
                </div>
                <!-- Barra de progreso visual -->
                <div class="progress-container">
                    <div class="progress-bar" [style.width.%]="item.porcentajeCompletitud || 0"></div>
                </div>
              </div>
            </div>

            <div class="empty-state" *ngIf="filteredCases().length === 0">
              <div class="empty-icon-svg">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              </div>
              <p>No se encontraron trámites que coincidan con la búsqueda.</p>
            </div>
          </div>
        </div>

        <!-- MIS ACTIVIDADES (Tareas Pendientes) -->
        <div *ngSwitchCase="'MY_ACTIVITIES'" class="view-section">
          <header class="section-header">
            <div>
              <h1>Mis Tareas Pendientes</h1>
              <p>Actividades que requieren tu acción inmediata.</p>
            </div>
            <button class="secondary-btn" (click)="loadPendingActivities()">
              <span class="svg-icon mini">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
              </span>
              Actualizar
            </button>
          </header>

          <div class="activity-grid" *ngIf="pendingActivities().length > 0; else noActivities">
            <article class="activity-card" *ngFor="let activity of pendingActivities()" [class.submitting]="submittingId() === activity.actividadId">
              <div class="activity-header">
                <div class="node-info">
                  <span class="node-icon-svg">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  </span>
                  <div>
                    <h3>{{ activity.nombre || activity.nodeName }}</h3>
                    <div class="process-meta">
                      <span class="process-ref">Ref: {{ activity.processInstanceId.substring(0,8) }}</span>
                      <span class="workflow-ref" *ngIf="activity.workflowNombre">| {{ activity.workflowNombre }}</span>
                    </div>
                  </div>
                </div>
                <span class="priority-badge" *ngIf="activity.slaMinutos">
                  <span class="svg-icon mini text-muted">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  </span>
                  {{ activity.slaMinutos }} min
                </span>
              </div>

              <div class="activity-body">
                <!-- Renderizado dinámico de formulario -->
                <div class="dynamic-form" *ngIf="activity.formulario?.campos?.length; else simpleComment">
                   <div class="field" *ngFor="let field of activity.formulario!.campos; trackBy: trackFieldById">
                      <label>{{ field.label }} <span class="req" *ngIf="field.required">*</span></label>
                      
                      <ng-container [ngSwitch]="field.tipo">
                        <input *ngSwitchCase="'text'" type="text" [placeholder]="field.placeholder || ''" 
                          [ngModel]="formValues()[activity.actividadId]?.[field.id]"
                          (ngModelChange)="setFormValue(activity.actividadId, field.id, $event)">
                        
                        <input *ngSwitchCase="'number'" type="number" 
                          [ngModel]="formValues()[activity.actividadId]?.[field.id]"
                          (ngModelChange)="setFormValue(activity.actividadId, field.id, $event)">
                        
                        <textarea *ngSwitchCase="'textarea'" rows="2" 
                          [ngModel]="formValues()[activity.actividadId]?.[field.id]"
                          (ngModelChange)="setFormValue(activity.actividadId, field.id, $event)"></textarea>
                        
                        <select *ngSwitchCase="'select'" 
                          [ngModel]="formValues()[activity.actividadId]?.[field.id]"
                          (ngModelChange)="setFormValue(activity.actividadId, field.id, $event)">
                           <option value="">Seleccione...</option>
                           <option *ngFor="let opt of field.options" [value]="opt">{{ opt }}</option>
                        </select>
                        
                        <div *ngSwitchCase="'bool'" class="bool-toggle">
                           <button [class.active]="formValues()[activity.actividadId]?.[field.id] === true" 
                             (click)="setFormValue(activity.actividadId, field.id, true)">SÍ</button>
                           <button [class.active]="formValues()[activity.actividadId]?.[field.id] === false" 
                             (click)="setFormValue(activity.actividadId, field.id, false)" class="no">NO</button>
                        </div>

                         <!-- Campo tipo fecha -->
                         <input *ngSwitchCase="'date'" type="date"
                           [ngModel]="formValues()[activity.actividadId]?.[field.id]"
                           (ngModelChange)="setFormValue(activity.actividadId, field.id, $event)">

                         <!-- Campo tipo archivo -->
                         <div *ngSwitchCase="'file'" class="file-upload-field">
                           <label class="file-drop-zone"
                             [class.has-file]="getSelectedFile(activity.actividadId, field.id)">
                             <input type="file" class="hidden-file-input"
                               (change)="onFileSelected(activity.actividadId, field.id, $event)">
                             <ng-container *ngIf="getSelectedFile(activity.actividadId, field.id) as f; else noFile">
                               <span class="file-name">{{ f.name }}</span>
                               <span class="file-size">({{ (f.size / 1024).toFixed(1) }} KB)</span>
                               <button type="button" class="remove-file-btn"
                                 (click)="$event.preventDefault(); clearFile(activity.actividadId, field.id)">x</button>
                             </ng-container>
                             <ng-template #noFile>
                               <span>Click para seleccionar archivo</span>
                             </ng-template>
                           </label>
                         </div>
                      </ng-container>
                   </div>
                </div>
                <ng-template #simpleComment>
                   <div class="field">
                      <label>Comentario de resolución</label>
                      <textarea [ngModel]="formValues()[activity.actividadId]?.['__comment']" 
                        (ngModelChange)="setFormValue(activity.actividadId, '__comment', $event)" 
                        placeholder="Escribe aquí..."></textarea>
                   </div>
                </ng-template>
              </div>

              <div class="activity-actions">
                <button class="complete-btn" (click)="submitActivity(activity)" [disabled]="submittingId() === activity.actividadId">
                  {{ submittingId() === activity.actividadId ? 'Enviando...' : 'Completar Tarea' }}
                </button>
              </div>
            </article>
          </div>
          <ng-template #noActivities>
            <div class="empty-state">
              <div class="empty-icon-svg success">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
              </div>
              <p>¡Todo al día! No tienes tareas pendientes.</p>
            </div>
          </ng-template>
        </div>

        <!-- DETALLE DEL TRÁMITE (VISTA GRÁFICA) -->
        <div *ngSwitchCase="'DETAIL'" class="view-section">
          <header class="section-header">
            <button class="back-link" (click)="setView('CASES')">
              <span class="svg-icon mini">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
              </span>
              Volver al listado
            </button>
            <div class="detail-title-row">
              <h1>Detalle del Trámite: {{ selectedCase()?.codigo }}</h1>
              <span class="status-badge large" [attr.data-status]="selectedCase()?.estado">{{ selectedCase()?.estado }}</span>
            </div>
          </header>

          <div class="detail-grid">
            <!-- Sidebar con info -->
            <aside class="detail-sidebar">
              <div class="info-group">
                <label>Workflow</label>
                <p>{{ selectedCase()?.workflowNombre }}</p>
              </div>
              <div class="info-group">
                <label>Cliente</label>
                <p>{{ selectedCase()?.clienteNombre }}</p>
              </div>
              <div class="info-group">
                <label>Fecha Creación</label>
                <p>{{ selectedCase()?.createdAt | date:'medium' }}</p>
              </div>
              <div class="info-group">
                <label>Progreso</label>
                <div class="progress-wrap">
                   <span class="progress-text">{{ selectedCase()?.porcentajeCompletitud }}%</span>
                   <div class="progress-bg"><div class="progress-fill" [style.width.%]="selectedCase()?.porcentajeCompletitud"></div></div>
                </div>
              </div>
            </aside>

            <!-- Flujo Gráfico e Inspección -->
            <section class="flow-container">
              <div class="flow-tabs">
                <button [class.active]="detailTab() === 'DIAGRAM'" (click)="detailTab.set('DIAGRAM')">Diagrama Visual</button>
                <button [class.active]="detailTab() === 'TIMELINE'" (click)="detailTab.set('TIMELINE')">Línea de Vida</button>
              </div>

              <div class="tab-content">
                <!-- Diagrama de Workflow -->
                <div class="diagram-wrapper" *ngIf="detailTab() === 'DIAGRAM'">
                  <app-workflow-paper
                    #workflowViewer
                    [workflowData]="currentWorkflowDefinition()"
                    [autoFitLanes]="true"
                    [readOnly]="true"
                    (elementSelected)="onNodeSelected($event)">
                  </app-workflow-paper>

                  
                  <!-- Panel Flotante de Datos del Nodo -->
                  <div class="node-inspector" *ngIf="selectedNodeData()">
                    <div class="inspector-header">
                      <h4>{{ selectedNodeData()?.nombre }}</h4>
                      <button (click)="selectedNodeData.set(null)">×</button>
                    </div>
                    <div class="inspector-body">
                      <div class="status-indicator">
                         <span class="dot" [attr.data-status]="selectedNodeData()?.estado"></span>
                         {{ selectedNodeData()?.estado | titlecase }}
                      </div>

                      <div class="form-data-view" *ngIf="selectedNodeData()?.respuestaFormulario && hasKeys(selectedNodeData()?.respuestaFormulario)">
                        <h5>Datos Registrados:</h5>
                        <div class="data-item" *ngFor="let entry of selectedNodeData()?.respuestaFormulario | keyvalue">
                          <label>{{ getFieldLabel(entry.key) }}</label>
                          <ng-container *ngIf="isFileData(entry.value); else regularValue">
                            <div class="file-view-link" (click)="openFile(entry.value)" title="Click para abrir archivo">
                              <span class="svg-icon mini">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
                              </span>
                              <span class="file-name-text">{{ entry.value.nombre }}</span>
                            </div>
                          </ng-container>
                          <ng-template #regularValue>
                            <p>{{ entry.value || '---' }}</p>
                          </ng-template>
                        </div>
                      </div>
                      <div class="no-data-msg" *ngIf="!selectedNodeData()?.respuestaFormulario || !hasKeys(selectedNodeData()?.respuestaFormulario)">
                        No hay datos registrados en este nodo.
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Línea de Vida (Existente) -->
                <div class="timeline-wrapper" *ngIf="detailTab() === 'TIMELINE'">
                  <div class="flow-visual">
                    <div class="flow-step" *ngFor="let act of selectedCase()?.actividades; let last = last" [class.completed]="act.estado === 'completada'" [class.active]="act.estado === 'pendiente' || act.estado === 'en_ejecucion'">
                      <div class="step-marker">
                        <span class="step-icon">
                          @if (act.estado === 'completada') {
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="12" height="12"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          } @else {
                            <svg viewBox="0 0 24 24" fill="currentColor" width="8" height="8"><circle cx="12" cy="12" r="10"></circle></svg>
                          }
                        </span>
                      </div>
                      <div class="step-content">
                        <div class="step-header">
                          <h4>{{ act.nombre || act.nodeId }}</h4>
                          <span class="step-date">{{ act.fechaInicio | date:'dd/MM HH:mm' }}</span>
                        </div>
                        <p class="step-status">{{ act.estado | titlecase }}</p>
                        <div class="step-assignee" *ngIf="act.usuarioNombre">
                           <span class="svg-icon mini">
                             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                           </span>
                           {{ act.usuarioNombre }}
                        </div>
                      </div>
                      <div class="step-connector" *ngIf="!last"></div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Historial de eventos -->
              <div class="history-log" *ngIf="selectedCase()?.historial?.length">
                <h4>Historial de Eventos</h4>
                <div class="log-item" *ngFor="let event of selectedCase()?.historial">
                   <span class="log-date">{{ event.fecha | date:'short' }}</span>
                   <span class="log-msg">{{ event.detalle }}</span>
                   <span class="log-user">por {{ event.userName }}</span>
                </div>
              </div>
            </section>
          </div>
        </div>

        <!-- CREAR TRÁMITE -->
        <div *ngSwitchCase="'CREATE'" class="view-section">
           <header class="section-header">
             <button class="back-link" (click)="setView('CASES')">
               <span class="svg-icon mini">
                 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
               </span>
               Cancelar
             </button>
             <h1>Iniciar Nuevo Trámite</h1>
             <p>Selecciona un proceso para comenzar una nueva instancia.</p>
           </header>

           <div class="create-form-container">
             <div class="form-card">
               <div class="field">
                 <label>Seleccionar Flujo de Trabajo (Workflow)</label>
                 <select [(ngModel)]="newCaseWorkflowId">
                   <option value="">-- Elige un proceso --</option>
                   <option *ngFor="let wf of activeWorkflows()" [value]="wf.id">{{ wf.nombre }} ({{ wf.codigo }})</option>
                 </select>
               </div>

               <div class="field" *ngIf="!showCreateClientForm()">
                 <label>Cliente / Solicitante</label>
                 <div class="select-with-action">
                    <select [(ngModel)]="newCaseClientId">
                      <option value="">-- Selecciona un cliente --</option>
                      <option *ngFor="let client of clients()" [value]="client.id">{{ client.nombre }} ({{ client.email }})</option>
                    </select>
                    <button type="button" class="icon-btn" (click)="showCreateClientForm.set(true)" title="Crear nuevo cliente">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </button>
                 </div>
                 <p class="field-hint" *ngIf="clients().length === 0">No hay clientes registrados.</p>
               </div>

               <!-- Mini Formulario para Crear Cliente -->
               <div class="sub-form" *ngIf="showCreateClientForm()" @fadeIn>
                  <div class="sub-form-header">
                    <h4>Datos del Nuevo Cliente</h4>
                    <button type="button" class="close-sub-btn" (click)="showCreateClientForm.set(false)">Volver a selección</button>
                  </div>
                  
                  <div class="field">
                    <label>Nombre Completo</label>
                    <input type="text" [(ngModel)]="newClientData.nombre" placeholder="Ej. Juan Pérez">
                  </div>
                  
                  <div class="field">
                    <label>Correo Electrónico</label>
                    <input type="email" [(ngModel)]="newClientData.email" placeholder="juan@correo.com">
                  </div>

                  <button type="button" class="secondary-btn w-full" 
                    [disabled]="!newClientData.nombre || !newClientData.email || creatingClientUser"
                    (click)="createAndSelectClient()">
                    {{ creatingClientUser ? 'Registrando...' : 'Registrar y Seleccionar' }}
                  </button>
               </div>

               <div class="form-actions" *ngIf="!showCreateClientForm()">
                 <button class="primary-btn" [disabled]="!newCaseWorkflowId || !newCaseClientId || creatingCase" (click)="createInstance()">
                   {{ creatingCase ? 'Iniciando...' : 'Crear Trámite Ahora' }}
                 </button>
               </div>
             </div>
           </div>
        </div>

        <!-- ESTADO CARGANDO GENÉRICO -->
        <ng-template #loadingState>
          <div class="loading-wrapper">
            <div class="spinner"></div>
            <p>Cargando información...</p>
          </div>
        </ng-template>

      </main>
    </section>
  `,
  styles: [`
    :host { --primary: #3b82f6; --primary-dark: #2563eb; --bg: #f8fafc; --text: #1e293b; --text-muted: #64748b; --border: #e2e8f0; --white: #ffffff; }

    .page-container { background: var(--bg); min-height: calc(100vh - 64px); padding: 20px; font-family: 'Inter', system-ui, sans-serif; color: var(--text); }

    /* Nav interna */
    .internal-nav { display: flex; justify-content: space-between; align-items: center; background: var(--white); padding: 12px 24px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin-bottom: 24px; border: 1px solid var(--border); }
    .nav-links { display: flex; gap: 8px; }
    .nav-links button { background: none; border: none; padding: 10px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; color: var(--text-muted); transition: all 0.2s; display: flex; align-items: center; gap: 8px; }
    .nav-links button:hover { background: #f1f5f9; color: var(--text); }
    .nav-links button.active { background: #eff6ff; color: var(--primary); }
    .count-badge { background: #ef4444; color: white; font-size: 10px; padding: 2px 6px; border-radius: 10px; font-weight: 800; }

    /* SVG Icon styles */
    .svg-icon { display: inline-flex; width: 18px; height: 18px; color: inherit; }
    .svg-icon.mini { width: 14px; height: 14px; }
    .svg-icon.white { color: white; }
    .svg-icon.text-muted { color: var(--text-muted); }

    .create-btn { background: var(--primary); color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.2); display: flex; align-items: center; gap: 8px; }
    .create-btn:hover { background: var(--primary-dark); transform: translateY(-1px); }

    /* Estructura secciones */
    .view-section { max-width: 1200px; margin: 0 auto; }
    .section-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .section-header h1 { font-size: 24px; font-weight: 800; margin: 0 0 4px; }
    .section-header p { margin: 0; color: var(--text-muted); font-size: 14px; }
    .back-link { background: none; border: none; color: var(--primary); font-weight: 600; cursor: pointer; padding: 0; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }

    .secondary-btn { background: var(--white); color: var(--text); border: 1px solid var(--border); padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; transition: 0.2s; display: flex; align-items: center; gap: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
    .secondary-btn:hover:not(:disabled) { background: #f8fafc; border-color: var(--primary); color: var(--primary); }
    .secondary-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Barra búsqueda */
    .search-bar { margin-bottom: 20px; }
    .search-input-wrapper { position: relative; width: 100%; }
    .search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--text-muted); width: 16px; height: 16px; }
    .search-bar input { width: 100%; padding: 12px 16px 12px 42px; border-radius: 10px; border: 1px solid var(--border); box-shadow: inset 0 1px 2px rgba(0,0,0,0.02); outline: none; transition: 0.2s; }
    .search-bar input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }

    /* Grid Trámites */
    .grid-container { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
    .case-card { background: var(--white); border-radius: 12px; border: 1px solid var(--border); overflow: hidden; cursor: pointer; transition: 0.3s; display: flex; }
    .case-card:hover { transform: translateY(-4px); box-shadow: 0 12px 20px -8px rgba(0,0,0,0.1); border-color: var(--primary); }
    .card-status { width: 6px; background: #94a3b8; }
    .card-status[data-status='en_proceso'] { background: var(--primary); }
    .card-status[data-status='finalizado'], .card-status[data-status='aprobado'] { background: #10b981; }
    .card-status[data-status='rechazado'] { background: #ef4444; }
    
    .card-content { padding: 16px; flex: 1; display: flex; flex-direction: column; gap: 8px; }
    .card-header { display: flex; justify-content: space-between; align-items: center; }
    .case-code { font-size: 12px; font-weight: 800; color: var(--text-muted); background: #f1f5f9; padding: 2px 8px; border-radius: 4px; }
    .status-badge { font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 20px; background: #f1f5f9; color: #475569; }
    .status-badge[data-status='en_proceso'] { background: #dbeafe; color: #1e40af; }
    .status-badge[data-status='aprobado'] { background: #d1fae5; color: #065f46; }

    .workflow-name { font-size: 16px; font-weight: 700; margin: 0; color: var(--text); }
    .card-footer { display: flex; justify-content: space-between; align-items: flex-end; font-size: 12px; color: var(--text-muted); margin-top: 4px; }
    .label { font-weight: 500; margin-right: 4px; }
    .value { color: var(--text); font-weight: 600; }

    .progress-container { height: 4px; background: #f1f5f9; border-radius: 2px; margin-top: 8px; overflow: hidden; }
    .progress-bar { height: 100%; background: linear-gradient(90deg, #60a5fa, #3b82f6); border-radius: 2px; transition: width 0.5s ease; }

    .empty-state { text-align: center; padding: 48px 24px; color: var(--text-muted); }
    .empty-icon-svg { width: 48px; height: 48px; margin: 0 auto 16px; color: var(--border); }
    .empty-icon-svg.success { color: #10b981; }

    /* Mis Actividades */
    .activity-grid { display: grid; gap: 16px; }
    .activity-card { background: var(--white); border-radius: 12px; border: 1px solid var(--border); padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .activity-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
    .node-info { display: flex; gap: 12px; align-items: center; }
    .node-icon-svg { width: 40px; height: 40px; background: #f8fafc; padding: 8px; border-radius: 10px; color: var(--primary); }
    .node-info h3 { margin: 0; font-size: 18px; font-weight: 700; }
    .process-meta { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text-muted); }
    .workflow-ref { font-weight: 600; color: var(--primary); }
    .priority-badge { font-size: 11px; font-weight: 700; color: var(--text-muted); display: flex; align-items: center; gap: 4px; }

    .dynamic-form { display: grid; gap: 12px; background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #f1f5f9; }
    .field { display: flex; flex-direction: column; gap: 6px; }
    .field label { font-size: 13px; font-weight: 600; color: #475569; }
    .req { color: #ef4444; }
    
    input, select, textarea { padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border); font-size: 14px; outline: none; background: white; color: var(--text); }
    input:focus, select:focus, textarea:focus { border-color: var(--primary); }

    .bool-toggle { display: flex; gap: 8px; }
    .bool-toggle button { flex: 1; padding: 10px; border-radius: 8px; border: 1px solid var(--border); background: white; font-weight: 700; cursor: pointer; transition: 0.2s; color: var(--text-muted); }
    .bool-toggle button.active { background: #10b981; color: white; border-color: #10b981; }
    .bool-toggle button.no.active { background: #ef4444; color: white; border-color: #ef4444; }

    .complete-btn { width: 100%; margin-top: 20px; background: var(--text); color: white; border: none; padding: 14px; border-radius: 10px; font-weight: 700; cursor: pointer; transition: 0.2s; }
    .complete-btn:hover { background: #000; transform: translateY(-1px); }

    /* Detalle Gráfico */
    .detail-grid { display: grid; grid-template-columns: 280px 1fr; gap: 24px; }
    .detail-sidebar { background: var(--white); padding: 20px; border-radius: 12px; border: 1px solid var(--border); height: fit-content; }
    .info-group { margin-bottom: 16px; }
    .info-group label { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
    .info-group p { margin: 4px 0 0; font-weight: 600; font-size: 15px; }

    .flow-container { background: var(--white); padding: 24px; border-radius: 12px; border: 1px solid var(--border); }
    .flow-visual { display: flex; flex-direction: column; gap: 0; padding-left: 20px; }
    .flow-step { position: relative; padding-bottom: 32px; padding-left: 32px; display: flex; gap: 16px; }
    .step-marker { position: absolute; left: 0; top: 0; width: 24px; height: 24px; border-radius: 50%; background: #f1f5f9; display: flex; align-items: center; justify-content: center; z-index: 2; border: 2px solid var(--white); box-shadow: 0 0 0 1px var(--border); color: var(--text-muted); }
    .flow-step.completed .step-marker { background: #10b981; color: white; border-color: #10b981; }
    .flow-step.active .step-marker { background: var(--primary); color: white; animation: pulse 2s infinite; }
    
    .step-connector { position: absolute; left: 11px; top: 24px; bottom: 0; width: 2px; background: var(--border); z-index: 1; }
    .flow-step.completed .step-connector { background: #10b981; }

    .step-content { flex: 1; }
    .step-header { display: flex; justify-content: space-between; }
    .step-header h4 { margin: 0; font-size: 16px; font-weight: 700; }
    .step-date { font-size: 11px; color: var(--text-muted); }
    .step-status { margin: 4px 0; font-size: 12px; font-weight: 600; color: var(--text-muted); }
    .step-assignee { font-size: 11px; font-weight: 700; color: var(--primary); display: flex; align-items: center; gap: 4px; }

    /* Crear Trámite UI */
    .create-form-container { display: flex; justify-content: center; padding: 40px 0; }
    .form-card { background: var(--white); padding: 32px; border-radius: 16px; border: 1px solid var(--border); width: 100%; max-width: 500px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); display: grid; gap: 20px; }
    .primary-btn { background: var(--primary); color: white; border: none; padding: 14px; border-radius: 10px; font-weight: 700; cursor: pointer; }
    .w-full { width: 100%; }

    .select-with-action { display: flex; gap: 8px; }
    .select-with-action select { flex: 1; }
    .icon-btn { background: var(--white); color: var(--text); border: 1px solid var(--border); border-radius: 8px; width: 42px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
    .icon-btn:hover { background: var(--primary); color: white; border-color: var(--primary); }

    .sub-form { background: #f8fafc; border: 1px solid var(--border); border-radius: 12px; padding: 16px; display: grid; gap: 12px; }
    .sub-form-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .sub-form-header h4 { margin: 0; font-size: 14px; color: var(--text); }
    .close-sub-btn { background: none; border: none; color: var(--text-muted); font-size: 12px; cursor: pointer; text-decoration: underline; }

    .field-hint { margin: 4px 0 0; font-size: 11px; color: var(--text-muted); }

    /* Estilos del Diagrama y Tabs */
    .flow-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--border); margin-bottom: 16px; }
    .flow-tabs button { padding: 8px 16px; border: none; background: none; font-size: 13px; font-weight: 600; color: var(--text-muted); cursor: pointer; border-bottom: 2px solid transparent; transition: 0.2s; }
    .flow-tabs button:hover { color: var(--text); }
    .flow-tabs button.active { color: var(--primary); border-bottom-color: var(--primary); }

    .tab-content { position: relative; height: 500px; background: white; border-radius: 12px; border: 1px solid var(--border); overflow: hidden; }
    .diagram-wrapper { width: 100%; height: 100%; position: relative; }
    .timeline-wrapper { width: 100%; height: 100%; overflow-y: auto; padding: 20px; box-sizing: border-box; }

    .node-inspector { position: absolute; top: 16px; right: 16px; width: 280px; background: white; border: 1px solid var(--border); border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); z-index: 100; display: flex; flex-direction: column; animation: slideIn 0.3s ease-out; }
    @keyframes slideIn { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

    .inspector-header { padding: 12px 16px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
    .inspector-header h4 { margin: 0; font-size: 14px; color: var(--text); }
    .inspector-header button { background: none; border: none; font-size: 20px; color: var(--text-muted); cursor: pointer; line-height: 1; }

    .inspector-body { padding: 16px; max-height: 400px; overflow-y: auto; }
    .status-indicator { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; margin-bottom: 16px; color: var(--text-muted); }
    .dot { width: 8px; height: 8px; border-radius: 50%; }
    .dot[data-status="completada"] { background: #22c55e; box-shadow: 0 0 8px rgba(34, 197, 94, 0.4); }
    .dot[data-status="pendiente"] { background: #3b82f6; }
    .dot[data-status="en_ejecucion"] { background: #f59e0b; animation: pulse-yellow 2s infinite; }

    @keyframes pulse-yellow { 0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); } 70% { box-shadow: 0 0 0 6px rgba(245, 158, 11, 0); } 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); } }

    .form-data-view h5 { margin: 0 0 12px; font-size: 12px; color: var(--text); text-transform: uppercase; letter-spacing: 0.5px; }
    .data-item { margin-bottom: 12px; }
    .data-item label { display: block; font-size: 11px; color: var(--text-muted); margin-bottom: 2px; }
    .data-item p { margin: 0; font-size: 13px; color: var(--text); font-weight: 500; background: #f8fafc; padding: 6px 10px; border-radius: 6px; }
    .no-data-msg { font-size: 12px; color: var(--text-muted); text-align: center; font-style: italic; padding: 20px 0; }

    @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); } 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); } }

    /* File Upload Field */
    .file-upload-field { margin-top: 2px; }
    .file-drop-zone { display: flex; align-items: center; gap: 10px; border: 2px dashed var(--border); border-radius: 10px; padding: 14px 16px; cursor: pointer; transition: 0.2s; background: #f8fafc; color: var(--text-muted); font-size: 13px; }
    .file-drop-zone:hover { border-color: var(--primary); background: #eff6ff; color: var(--primary); }
    .file-drop-zone.has-file { border-style: solid; border-color: #10b981; background: #f0fdf4; color: #065f46; }
    .hidden-file-input { display: none; }
    .upload-icon, .file-icon { display: flex; align-items: center; flex-shrink: 0; }
    .file-name { flex: 1; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .file-size { font-size: 11px; color: var(--text-muted); flex-shrink: 0; }
    .remove-file-btn { background: none; border: none; font-size: 18px; line-height: 1; cursor: pointer; color: #ef4444; padding: 0 4px; flex-shrink: 0; }
    .remove-file-btn:hover { color: #b91c1c; }

    /* File View Link in Inspector */
    .file-view-link { display: flex; align-items: center; gap: 8px; background: #eff6ff; padding: 8px 12px; border-radius: 8px; cursor: pointer; border: 1px solid #dbeafe; transition: 0.2s; color: var(--primary); margin-top: 4px; }
    .file-view-link:hover { background: #dbeafe; border-color: var(--primary); transform: translateY(-1px); }
    .file-name-text { font-size: 13px; font-weight: 600; text-decoration: underline; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
  `]
})
export class MyActivitiesComponent implements OnInit {
  readonly processService = inject(ProcessInstanceService);
  readonly workflowService = inject(WorkflowService);
  readonly authService = inject(AuthService);
  
  // Estado de Detalle y Diagrama
  detailTab = signal<'DIAGRAM' | 'TIMELINE'>('DIAGRAM');
  currentWorkflowDefinition = signal<Workflow | null>(null);
  selectedNodeData = signal<any>(null);
  @ViewChild('workflowViewer') workflowViewer?: WorkflowPaperComponent;


  // Estado UI
  viewMode = signal<ViewMode>('CASES');
  searchQuery = '';
  
  // Datos
  allCases = this.processService.processInstances;
  
  // Actividades pendientes individuales (ya aplanadas por el servicio)
  pendingActivities = this.processService.pendingActivities;

  selectedCase = this.processService.selectedProcess;
  activeWorkflows = signal<WorkflowListItem[]>([]);
  clients = signal<UserListItem[]>([]);
  
  // Creación
  newCaseWorkflowId = '';
  newCaseClientId = '';
  creatingCase = false;

  // Formulario Nuevo Cliente
  showCreateClientForm = signal(false);
  creatingClientUser = false;
  newClientData = { nombre: '', email: '' };

  // Forms
  readonly formValues = signal<Record<string, Record<string, any>>>({});
  readonly submittingId = signal<string | null>(null);
  /** Archivos seleccionados: actividadId → fieldId → File */
  private readonly fileStore = signal<Record<string, Record<string, File>>>({});

  ngOnInit() {
    this.loadAllCases();
    this.loadPendingActivities();
    this.loadActiveWorkflows();
    this.loadClients();
  }

  setView(mode: ViewMode) {
    this.viewMode.set(mode);
    if (mode === 'CASES') this.loadAllCases();
    if (mode === 'MY_ACTIVITIES') this.loadPendingActivities();
    if (mode === 'CREATE') {
      this.loadActiveWorkflows();
      this.loadClients();
    }
  }

  loadAllCases() {
    this.processService.listAllProcesses().subscribe();
  }

  loadPendingActivities() {
    this.processService.listPendingActivities().subscribe(instances => {
      // Inicializar el almacenamiento de formularios para cada actividad
      const currentValues = { ...this.formValues() };
      this.pendingActivities().forEach(act => {
        if (!currentValues[act.actividadId]) {
          currentValues[act.actividadId] = {};
        }
      });
      this.formValues.set(currentValues);
    });
  }

  loadActiveWorkflows() {
    this.workflowService.listActiveWorkflowsForProcesses().subscribe(wfs => {
      this.activeWorkflows.set(wfs);
    });
  }

  loadClients() {
    this.workflowService.listUsers({ role: 'Cliente', activo: true }).subscribe(users => {
      this.clients.set(users);
    });
  }

  createAndSelectClient() {
    this.creatingClientUser = true;
    this.authService.registerWithoutLogin({
      nombre: this.newClientData.nombre,
      email: this.newClientData.email,
      password: 'Client' + Math.random().toString(36).substring(7), // Password aleatorio inicial
      role: 'Cliente'
    }).subscribe({
      next: (res) => {
        this.creatingClientUser = false;
        this.showCreateClientForm.set(false);
        this.newClientData = { nombre: '', email: '' };
        
        // Recargar clientes y seleccionar el nuevo
        this.workflowService.listUsers({ role: 'Cliente', activo: true }).subscribe(users => {
          this.clients.set(users);
          const newUser = users.find(u => u.email === res.user.email);
          if (newUser) this.newCaseClientId = newUser.id;
        });
      },
      error: () => this.creatingClientUser = false
    });
  }

  filteredCases() {
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) return this.allCases();
    return this.allCases().filter(c => 
      c.codigo?.toLowerCase().includes(q) || 
      c.id.toLowerCase().includes(q) || 
      c.clienteNombre?.toLowerCase().includes(q) ||
      c.workflowNombre?.toLowerCase().includes(q)
    );
  }

  async viewDetail(item: ProcessInstance) {
    this.processService.getProcessById(item.id).subscribe(async (process) => {
      this.selectedNodeData.set(null);
      this.currentWorkflowDefinition.set(null); // Resetear antes de cargar

      // Cargar Definición de Workflow para el diagrama
      try {
        let wf: Workflow | null = null;

        // 1. Intentar usar snapshot si existe y tiene lanes/nodes
        const snap = process.workflowSnapshot;
        if (snap && Array.isArray(snap.lanes) && snap.lanes.length > 0) {
          console.log('viewDetail - using workflowSnapshot from process instance', {
            version: snap.workflowVersion,
            nodes: snap.nodes?.length,
            edges: snap.edges?.length,
            lanes: snap.lanes?.length
          });
          // Normalizar WorkflowSnapshot → Workflow
          wf = {
            id: snap.id ?? process.workflowId,
            codigo: snap.workflowVersion ?? '',
            nombre: process.workflowNombre ?? 'Workflow (Snapshot)',
            descripcion: '',
            estado: 'activo',
            lanes: snap.lanes ?? [],
            nodes: snap.nodes ?? [],
            edges: snap.edges ?? [],
            createdAt: snap.capturedAt ?? process.createdAt,
            updatedAt: snap.capturedAt ?? process.updatedAt
          } as Workflow;
        } else {
          console.log('viewDetail - no snapshot found, fetching original workflow', process.workflowId);
          wf = await this.workflowService.getWorkflow(process.workflowId).toPromise() || null;
        }


        if (wf) {
          // Cambiar vista DESPUÉS de tener los datos listos
          this.viewMode.set('DETAIL');
          this.detailTab.set('DIAGRAM');
          this.currentWorkflowDefinition.set(wf);

          // Esperar a que Angular renderice el componente app-workflow-paper
          // y su ngAfterViewInit inicialice el graph antes de colorear nodos
          this.waitForPaperAndHighlight(process, 0);
        } else {
          this.viewMode.set('DETAIL');
          this.detailTab.set('TIMELINE'); // Fallback a línea de vida si no hay diagrama
        }
      } catch (e) {
        console.error('Error loading workflow definition', e);
        this.viewMode.set('DETAIL');
        this.detailTab.set('TIMELINE');
      }
    });
  }

  /** Reintenta hasta que workflowViewer.graph esté listo (máx. 2s) antes de colorear */
  private waitForPaperAndHighlight(process: any, attempt: number): void {
    const MAX_ATTEMPTS = 20; // 20 × 100ms = 2 segundos
    if (attempt >= MAX_ATTEMPTS) {
      console.warn('workflowViewer graph did not initialize in time, skipping highlight');
      return;
    }
    if (this.workflowViewer && this.workflowViewer.graph) {
      setTimeout(() => this.highlightWorkflowNodes(process), 50);
    } else {
      setTimeout(() => this.waitForPaperAndHighlight(process, attempt + 1), 100);
    }
  }

  private highlightWorkflowNodes(process: any) {
    if (!this.workflowViewer) return;
    
    const graph = this.workflowViewer.graph;
    if (!graph) return;

    const completedNodeIds = new Set(
      process.actividades
        .filter((a: any) => a.estado === 'completada')
        .map((a: any) => a.nodeId)
    );

    const currentNodeIds = new Set(process.currentNodeIds || []);

    graph.getElements().forEach(el => {
      if (el.get('type') === 'app.Lane') return;

      const nodeId = String(el.id);
      let fill = '#ffffff';
      let stroke = '#6366f1';
      let labelColor = '#1e293b';

      if (completedNodeIds.has(nodeId)) {
        fill = '#dcfce7'; // Verde claro
        stroke = '#16a34a'; // Verde
      } else if (currentNodeIds.has(nodeId)) {
        fill = '#fef9c3'; // Amarillo claro
        stroke = '#ca8a04'; // Dorado/Amarillo
        el.attr('body/style', 'animation: pulse 2s infinite');
      } else {
        // En espera
        fill = '#eff6ff'; // Azul muy claro
        stroke = '#3b82f6'; // Azul
      }

      el.attr('body/fill', fill);
      el.attr('body/stroke', stroke);
      el.attr('label/fill', labelColor);
    });
  }

  onNodeSelected(cellView: any) {
    if (!cellView || !cellView.model || cellView.model.get('type') === 'app.Lane') {
      this.selectedNodeData.set(null);
      return;
    }

    const nodeId = String(cellView.model.id);
    const process = this.selectedCase();
    if (!process) return;

    // Buscar la última actividad de este nodo
    const activity = [...(process.actividades || [])]
      .reverse()
      .find(a => a.nodeId === nodeId);

    if (activity) {
      this.selectedNodeData.set(activity);
    } else {
      // Si no hay actividad, mostrar info básica del nodo de la definición
      const nodeDef = this.currentWorkflowDefinition()?.nodes.find(n => n.id === nodeId);
      this.selectedNodeData.set({
        nombre: nodeDef?.nombre || 'Nodo sin actividad',
        estado: 'pendiente',
        respuestaFormulario: {}
      });
    }
  }

  hasKeys(obj: any): boolean {
    return obj && Object.keys(obj).length > 0;
  }

  trackFieldById(index: number, field: any) {
    return field.id;
  }

  getFieldLabel(fieldId: any): string {
    const activity = this.selectedNodeData();
    if (!activity || !activity.formulario) return String(fieldId);
    
    const field = activity.formulario.campos.find((f: any) => f.id === String(fieldId));
    return field ? field.label : String(fieldId);
  }

  isFileData(value: any): boolean {
    return value && typeof value === 'object' && value.url && value.nombre;
  }

  openFile(fileData: any): void {
    if (fileData?.url) {
      window.open(fileData.url, '_blank');
    }
  }

  // Lógica de formularios para actividades
  getFormStore(activityId: string): Record<string, any> {
    if (!this.formValues()[activityId]) {
      this.formValues.update(v => ({ ...v, [activityId]: {} }));
    }
    return this.formValues()[activityId];
  }

  setFormValue(activityId: string, fieldId: string, value: any) {
    this.formValues.update(v => ({
      ...v, 
      [activityId]: { ...v[activityId], [fieldId]: value }
    }));
  }

  // ── Gestión de archivos ──────────────────────────────────────────────────

  getSelectedFile(actividadId: string, fieldId: string): File | null {
    return this.fileStore()[actividadId]?.[fieldId] ?? null;
  }

  onFileSelected(actividadId: string, fieldId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.fileStore.update(store => ({
      ...store,
      [actividadId]: { ...(store[actividadId] ?? {}), [fieldId]: file }
    }));
  }

  clearFile(actividadId: string, fieldId: string): void {
    this.fileStore.update(store => {
      const activity = { ...(store[actividadId] ?? {}) };
      delete activity[fieldId];
      return { ...store, [actividadId]: activity };
    });
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  submitActivity(activity: ProcessActivity) {
    const vals = this.getFormStore(activity.actividadId);
    this.submittingId.set(activity.actividadId);

    // Si no hay campos de formulario, usar comentario genérico
    const respuestaFormulario: Record<string, any> = activity.formulario?.campos?.length
      ? { ...vals }
      : { comentario: (vals['__comment'] as string) || '' };


    // Asegurar que los campos tipo file sean null en el JSON (según contrato)
    (activity.formulario?.campos ?? []).forEach(f => {
      if (f.tipo === 'file') {
        respuestaFormulario[f.id] = null;
      }
    });

    const payload = {
      respuestaFormulario,
      comentarios: vals['__comment'] || 'Completado por funcionario'
    };


    // Recopilar campos tipo 'file' que tengan un archivo seleccionado
    const fileFields = (activity.formulario?.campos ?? [])
      .filter(f => f.tipo === 'file');
    const selectedFiles = fileFields
      .map(f => ({ fieldId: f.id, file: this.getSelectedFile(activity.actividadId, f.id) }))
      .filter((f): f is { fieldId: string; file: File } => f.file !== null);

    // Construir FormData para multipart/form-data
    const formData = new FormData();
    formData.append('payload', JSON.stringify(payload));
    selectedFiles.forEach(({ fieldId, file }) => {
      formData.append('files', file);
      formData.append('fileFieldIds', fieldId);
    });

    this.processService.completeActivityRaw(activity.actividadId, formData).subscribe({
      next: () => {
        this.submittingId.set(null);
        // Limpiar archivos de esta actividad
        this.fileStore.update(s => { const n = { ...s }; delete n[activity.actividadId]; return n; });
        this.loadPendingActivities();
      },
      error: () => this.submittingId.set(null)
    });
  }

  createInstance() {
    this.creatingCase = true;
    this.processService.createProcessInstance({
      workflowId: this.newCaseWorkflowId,
      clienteId: this.newCaseClientId
    }).subscribe({
      next: () => {
        this.creatingCase = false;
        this.newCaseWorkflowId = '';
        this.newCaseClientId = '';
        this.setView('CASES');
      },
      error: () => this.creatingCase = false
    });
  }
}
