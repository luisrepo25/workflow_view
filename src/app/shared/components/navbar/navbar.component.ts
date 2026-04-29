import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-navbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <nav class="navbar">
      <div class="navbar-container">
        <div class="navbar-brand">
          <h2>Workflow Editor</h2>
        </div>

        <div class="navbar-menu">
          <a routerLink="/dashboard" class="nav-link" routerLinkActive="active">Dashboard</a>
          
          @if (authService.hasRole('Diseñador') || authService.hasRole('Admin')) {
            <a routerLink="/workflows" class="nav-link" routerLinkActive="active">Workflows</a>
            <a routerLink="/collaborations/pending" class="nav-link" routerLinkActive="active">Invitaciones</a>
            <a routerLink="/admin/users" class="nav-link" routerLinkActive="active">Usuarios</a>
          }

          <!-- @if (authService.hasRole('Funcionario') || authService.hasRole('Admin')) {
            <a routerLink="/my-cases" class="nav-link" routerLinkActive="active">Gestión de Trámites</a>
          } -->

          @if (authService.hasRole('Funcionario') || authService.hasRole('Admin')) {
            <a routerLink="/my-activities" class="nav-link" routerLinkActive="active">Mis Tareas</a>
          }
        </div>

        @if (authService.currentUser(); as user) {
          <div class="navbar-user">
            <span class="user-name">{{ user.nombre }}</span>
            <a routerLink="/profile" class="nav-link text-link">Perfil</a>
            <button class="btn-logout" (click)="logout()">Cerrar Sesión</button>
          </div>
        }
      </div>
    </nav>
  `,
  styles: [`
    .navbar {
      background: #1e293b;
      color: #f8fafc;
      padding: 0.75rem 0;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      height: 65px;
      box-sizing: border-box;
    }

    .navbar-container {
      display: flex;
      justify-content: space-between;
      align-items: center;
      max-width: 1600px;
      margin: 0 auto;
      padding: 0 2rem;
      height: 100%;
    }

    .navbar-brand h2 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
      letter-spacing: -0.025em;
      color: #f1f5f9;
    }

    .navbar-menu {
      display: flex;
      gap: 1.5rem;
      align-items: center;
    }

    .nav-link {
      color: #cbd5e1;
      text-decoration: none;
      padding: 0.5rem 0.75rem;
      border-radius: 6px;
      font-weight: 500;
      font-size: 0.95rem;
      transition: all 0.2s ease-in-out;
    }

    .nav-link:hover, .nav-link.active {
      background: rgba(241, 245, 249, 0.1);
      color: #f8fafc;
    }

    .navbar-user {
      display: flex;
      align-items: center;
      gap: 1.25rem;
    }

    .user-name {
      font-weight: 500;
      font-size: 0.95rem;
      color: #e2e8f0;
    }

    .text-link {
      padding: 0;
    }
    
    .text-link:hover {
      background: transparent;
      text-decoration: underline;
    }

    .btn-logout {
      background: #ef4444;
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      font-weight: 500;
      font-size: 0.9rem;
      border-radius: 6px;
      cursor: pointer;
      transition: background-color 0.2s ease;
    }

    .btn-logout:hover {
      background: #dc2626;
    }

    @media (max-width: 768px) {
      .navbar-container {
        flex-direction: column;
        gap: 1rem;
      }

      .navbar-menu {
        width: 100%;
        justify-content: center;
      }
    }
  `]
})
export class NavbarComponent {
  authService = inject(AuthService);

  logout(): void {
    this.authService.logout();
  }
}
