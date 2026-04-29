import { Component, EventEmitter, Output, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-workflow-toolbar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="toolbar">
      <div class="brand">
        <strong>Editor</strong>
      </div>
      
      <div class="actions">
        <div class="dropdown-container">
          <button class="btn primary" (click)="toggleDepartmentDropdown()">
            + Agregar Calle (Depto)
          </button>
          <div class="dropdown" *ngIf="showDepartmentDropdown">
            <div class="dropdown-item dropdown-state" *ngIf="departmentsLoading">
              Cargando departamentos de empresa...
            </div>

            <div class="dropdown-item dropdown-state dropdown-error" *ngIf="!departmentsLoading && departmentsError">
              <div>{{ departmentsError }}</div>
              <button class="link-button" (click)="retryDepartments.emit()">Reintentar</button>
            </div>

            <div class="dropdown-item dropdown-state" *ngIf="!departmentsLoading && !departmentsError && (!departments || departments.length === 0)">
              No hay departamentos de empresa configurados.
              <div class="dropdown-help">Pide a administración que registre departamentos para poder crear calles.</div>
              <button class="link-button" (click)="retryDepartments.emit()">Reintentar</button>
            </div>

            <ng-container *ngIf="!departmentsLoading && !departmentsError && departments && departments.length > 0">
              <button class="dropdown-item" *ngFor="let dept of departments" (click)="onAddLaneFromDepartment(dept)">
                <span class="dept-name">{{ dept.nombre }}</span>
                <span class="dept-description" *ngIf="dept.descripcion">{{ dept.descripcion }}</span>
              </button>
            </ng-container>
          </div>
        </div>
        
        <div class="divider"></div>
        <button class="btn" (click)="addNode.emit('actividad')">Actividad</button>
        <button class="btn" (click)="addNode.emit('decision')">Decisión</button>
      </div>

      <div class="actions-right">
        <button class="btn success" (click)="save.emit()">Guardar Diseño</button>
      </div>
    </div>
  `,
  styles: [`
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

    .dropdown-container {
      position: relative;
    }
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
    .dropdown-item:hover {
      background: #f1f5f9;
      color: #1e293b;
    }
    .dropdown-state {
      cursor: default;
      white-space: normal;
      line-height: 1.35;
    }
    .dropdown-error {
      color: #b91c1c;
    }
    .dept-name {
      display: block;
      font-weight: 600;
      color: #1e293b;
    }
    .dept-description {
      display: block;
      margin-top: 2px;
      font-size: 12px;
      color: #64748b;
    }
    .dropdown-help {
      margin-top: 4px;
      font-size: 12px;
      color: #64748b;
    }
    .link-button {
      margin-top: 8px;
      border: none;
      background: none;
      padding: 0;
      color: #2563eb;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
    }
    .link-button:hover {
      text-decoration: underline;
    }
  `]
})
export class WorkflowToolbarComponent {
  @Input() departments: any[] = [];
  @Input() departmentsLoading = false;
  @Input() departmentsError: string | null = null;
  @Output() addLane = new EventEmitter<void>();
  @Output() addLaneFromDepartment = new EventEmitter<any>();
  @Output() addNode = new EventEmitter<string>();
  @Output() save = new EventEmitter<void>();
  @Output() retryDepartments = new EventEmitter<void>();

  public showDepartmentDropdown = false;

  toggleDepartmentDropdown(): void {
    this.showDepartmentDropdown = !this.showDepartmentDropdown;
  }

  onAddLaneFromDepartment(dept: any): void {
    this.addLaneFromDepartment.emit(dept);
    this.showDepartmentDropdown = false;
  }
}
