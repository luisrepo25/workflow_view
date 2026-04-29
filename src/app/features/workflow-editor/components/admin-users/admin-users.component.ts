import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../core/services/auth.service';
import { DepartmentService } from '../../../../core/services/department.service';
import { WorkflowService, UserListItem } from '../../../../core/services/workflow.service';
import { RegisterRequest } from '../../../../shared/models';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="page-header">
        <h1>Administración de usuarios</h1>
        <p>Gestión de cuentas y creación de nuevos usuarios.</p>
      </header>

      <div class="users-container">
        <!-- Formulario -->
        <div class="card">
          <h2>Registrar Nuevo Usuario</h2>
          
          <form (ngSubmit)="onSubmit()" #registerForm="ngForm" class="user-form">
            @if (successMsg()) {
              <div class="alert alert-success">{{ successMsg() }}</div>
            }
            @if (authService.error()) {
              <div class="alert alert-error">{{ authService.error() }}</div>
            }

            <div class="form-group">
              <label for="nombre">Nombre Completo</label>
              <input type="text" id="nombre" name="nombre" [(ngModel)]="request.nombre" required />
            </div>

            <div class="form-group">
              <label for="email">Correo Electrónico</label>
              <input type="email" id="email" name="email" [(ngModel)]="request.email" required />
            </div>

            <div class="form-group">
              <label for="password">Contraseña (Temporal)</label>
              <input type="password" id="password" name="password" [(ngModel)]="request.password" required />
            </div>

            <div class="form-row">
              <div class="form-group flex-1">
                <label for="rol">Rol</label>
                <select id="rol" name="rol" [(ngModel)]="request.role" required (ngModelChange)="onRoleChange()">
                  <option value="Funcionario">Funcionario</option>
                  <option value="Cliente">Cliente</option>
                  <option value="Diseñador">Diseñador</option>
                  <option value="Administrador">Administrador</option>
                </select>
              </div>

              <div class="form-group flex-1">
                <label for="telefono">Teléfono (Opcional)</label>
                <input type="text" id="telefono" name="telefono" [(ngModel)]="request.telefono" />
              </div>
            </div>

            @if (request.role === 'Funcionario') {
              <div class="form-group">
                <label for="departmentId">Departamento <span class="required">*</span></label>
                @if (deptService.isLoading()) {
                  <div class="loading-hint">Cargando departamentos...</div>
                } @else if (deptService.error()) {
                  <div class="alert alert-error">{{ deptService.error() }} <button type="button" class="link-btn" (click)="loadDepts()">Reintentar</button></div>
                } @else {
                  <select id="departmentId" name="departmentId" [(ngModel)]="request.departmentId" required>
                    <option value="">-- Selecciona departamento --</option>
                    @for (dept of deptService.departments(); track dept.id) {
                      <option [value]="dept.id">{{ dept.nombre }}</option>
                    }
                  </select>
                  @if (!deptService.departments() || deptService.departments().length === 0) {
                    <p class="hint">No hay departamentos registrados. Crea uno desde el editor.</p>
                  }
                }
              </div>
            }

            <div class="form-actions">
              <button type="submit" class="btn-primary"
                [disabled]="registerForm.invalid || authService.isLoading() || (request.role === 'Funcionario' && !request.departmentId)">
                {{ authService.isLoading() ? 'Registrando...' : 'Registrar Usuario' }}
              </button>
            </div>
          </form>
        </div>

        <!-- Lista de Usuarios -->
        <div class="card users-list-card">
          <h2>Lista de Usuarios</h2>
          @if (loadingUsers()) {
            <div class="loading-hint">Cargando usuarios...</div>
          } @else if (errorUsers()) {
            <div class="alert alert-error">{{ errorUsers() }}</div>
          } @else {
            <div class="table-responsive">
              <table class="modern-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>Rol / Depto</th>
                  </tr>
                </thead>
                <tbody>
                  @for (user of users(); track user.id) {
                    <tr>
                      <td>
                        <div class="user-name">{{ user.nombre }}</div>
                        <div class="user-id">ID: {{ user.id }}</div>
                      </td>
                      <td>{{ user.email }}</td>
                      <td>
                        <div class="role-badge" [class]="'role-' + (user.rol | lowercase)">{{ user.rol || 'N/A' }}</div>
                        @if (user.departmentId) {
                          <div class="dept-text">{{ getDeptName(user.departmentId) }}</div>
                        }
                      </td>
                    </tr>
                  }
                  @if (users().length === 0) {
                    <tr>
                      <td colspan="3" class="empty-state">No hay usuarios registrados.</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      </div>
    </section>
  `,
  styles: [`
    .page { padding: 24px; max-width: 1400px; margin: 0 auto; font-family: 'Inter', sans-serif; }
    .page-header { margin-bottom: 24px; }
    .page-header h1 { margin: 0 0 8px; font-size: 1.75rem; color: #1e293b; font-weight: 700; }
    .page-header p { margin: 0; color: #64748b; }
    
    .users-container { display: grid; gap: 24px; grid-template-columns: 400px 1fr; align-items: start; }
    @media (max-width: 900px) {
      .users-container { grid-template-columns: 1fr; }
    }
    
    .card { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border: 1px solid #f1f5f9; }
    .card h2 { margin: 0 0 20px 0; font-size: 1.25rem; color: #1e293b; font-weight: 600; }
    
    .user-form { display: flex; flex-direction: column; gap: 16px; }
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-row { display: flex; gap: 16px; }
    .flex-1 { flex: 1; }
    
    label { font-size: 0.875rem; font-weight: 500; color: #475569; }
    .required { color: #ef4444; margin-left: 2px; }
    input, select { 
      padding: 10px 12px; 
      border: 1px solid #cbd5e1; 
      border-radius: 8px; 
      font-size: 0.95rem; 
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    input:focus, select:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
    
    .form-actions { margin-top: 12px; display: flex; justify-content: flex-end; }
    .btn-primary {
      background: #3b82f6; color: white; border: none;
      padding: 10px 24px; border-radius: 8px; font-weight: 600;
      cursor: pointer; transition: background-color 0.2s, transform 0.1s;
    }
    .btn-primary:hover:not(:disabled) { background: #2563eb; transform: translateY(-1px); }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
    
    .alert { padding: 12px; border-radius: 8px; font-size: 0.9rem; margin-bottom: 8px; font-weight: 500; }
    .alert-success { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
    .alert-error { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
    .loading-hint { font-size: 0.85rem; color: #64748b; padding: 8px 0; }
    .hint { font-size: 0.8rem; color: #94a3b8; margin: 4px 0 0; }
    .link-btn { background: none; border: none; color: #3b82f6; cursor: pointer; font-size: 0.85rem; padding: 0; margin-left: 8px; text-decoration: underline; }

    /* Table styles */
    .table-responsive { overflow-x: auto; }
    .modern-table { width: 100%; border-collapse: separate; border-spacing: 0; }
    .modern-table th {
      text-align: left; padding: 12px 16px; background: #f8fafc; color: #475569;
      font-weight: 600; font-size: 0.875rem; border-bottom: 1px solid #e2e8f0;
    }
    .modern-table td { padding: 16px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
    .modern-table tr:last-child td { border-bottom: none; }
    .modern-table tbody tr:hover { background: #f8fafc; }
    
    .user-name { font-weight: 600; color: #0f172a; font-size: 0.95rem; }
    .user-id { font-size: 0.75rem; color: #94a3b8; font-family: monospace; margin-top: 4px; }
    
    .role-badge {
      display: inline-block; padding: 4px 10px; border-radius: 20px;
      font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;
      background: #f1f5f9; color: #64748b;
    }
    .role-funcionario { background: #e0e7ff; color: #4338ca; }
    .role-cliente { background: #dcfce7; color: #15803d; }
    .role-diseñador { background: #fef3c7; color: #b45309; }
    .role-administrador { background: #fee2e2; color: #b91c1c; }
    
    .dept-text { font-size: 0.8rem; color: #64748b; margin-top: 6px; }
    .empty-state { text-align: center; padding: 40px; color: #64748b; font-style: italic; }
  `]
})
export class AdminUsersComponent implements OnInit {
  authService = inject(AuthService);
  deptService = inject(DepartmentService);
  workflowService = inject(WorkflowService);
  
  successMsg = signal<string>('');
  users = signal<UserListItem[]>([]);
  loadingUsers = signal<boolean>(false);
  errorUsers = signal<string | null>(null);
  
  request: RegisterRequest = {
    nombre: '',
    email: '',
    password: '',
    role: 'Funcionario',
    telefono: '',
    departmentId: ''
  };

  ngOnInit(): void {
    this.loadDepts();
    this.loadUsers();
  }

  loadDepts(): void {
    this.deptService.getDepartments().subscribe();
  }

  loadUsers(): void {
    this.loadingUsers.set(true);
    this.errorUsers.set(null);
    this.workflowService.listUsers().subscribe({
      next: (data) => {
        this.users.set(data);
        this.loadingUsers.set(false);
      },
      error: (err) => {
        console.error('Error loading users:', err);
        this.errorUsers.set('Error al cargar la lista de usuarios.');
        this.loadingUsers.set(false);
      }
    });
  }

  getDeptName(id: string): string {
    const dept = this.deptService.departments().find(d => d.id === id);
    return dept ? dept.nombre : id;
  }

  onRoleChange(): void {
    if (this.request.role !== 'Funcionario') {
      this.request.departmentId = undefined;
    }
  }

  onSubmit() {
    this.successMsg.set('');
    const payload: RegisterRequest = {
      ...this.request,
      departmentId: this.request.role === 'Funcionario' ? (this.request.departmentId || undefined) : undefined
    };

    this.authService.registerWithoutLogin(payload).subscribe({
      next: () => {
        this.successMsg.set(`Usuario ${this.request.nombre} registrado exitosamente.`);
        this.request = {
          nombre: '',
          email: '',
          password: '',
          role: 'Funcionario',
          telefono: '',
          departmentId: ''
        };
        this.loadUsers(); // Refresh list after creating
      }
    });
  }
}


