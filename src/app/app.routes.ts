import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { LoginComponent } from './features/auth/pages/login.component';
import { RegisterComponent } from './features/auth/pages/register.component';
import { DashboardComponent } from './features/dashboard/pages/dashboard.component';
import { WorkflowListComponent } from './features/workflow-editor/components/workflow-list/workflow-list.component';
import { WorkflowEditorPageComponent } from './features/workflow-editor/components/workflow-editor-page/workflow-editor-page.component';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  {
    path: 'auth',
    children: [
      { path: 'login', component: LoginComponent },
      { path: 'register', component: RegisterComponent },
      { path: '', redirectTo: 'login', pathMatch: 'full' }
    ]
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard]
  },
  {
    path: 'workflows',
    canActivate: [authGuard, roleGuard(['Diseñador'])],
    children: [
      { path: '', component: WorkflowListComponent },
      { path: ':id', component: WorkflowEditorPageComponent },
      { path: 'new', component: WorkflowEditorPageComponent }
    ]
  },
  {
    path: 'invitations/:workflowId',
      canActivate: [authGuard, roleGuard(['Diseñador'])],
    loadComponent: () => import('./features/workflow-editor/components/collaborators-list/collaborators-list.component').then(m => m.CollaboratorsListComponent)
  },
  {
    path: 'invitations',
      canActivate: [authGuard, roleGuard(['Diseñador'])],
    loadComponent: () => import('./features/workflow-editor/components/collaborators-list/collaborators-list.component').then(m => m.CollaboratorsListComponent)
  },
  {
    path: 'collaborations/pending',
    canActivate: [authGuard, roleGuard(['Diseñador'])],
    loadComponent: () => import('./features/workflow-editor/components/pending-collaborations/pending-collaborations.component').then(m => m.PendingCollaborationsComponent)
  },
  {
    path: 'my-activities',
      canActivate: [authGuard, roleGuard(['Funcionario'])],
    loadComponent: () => import('./features/workflow-editor/components/my-activities/my-activities.component').then(m => m.MyActivitiesComponent)
  },
  {
    path: 'my-cases',
      canActivate: [authGuard, roleGuard(['Funcionario'])],
    loadComponent: () => import('./features/workflow-editor/components/my-cases/my-cases.component').then(m => m.MyCasesComponent)
  },
  {
    path: 'admin',
      canActivate: [authGuard, roleGuard(['Admin', 'Diseñador'])],
    children: [
      {
        path: 'users',
        loadComponent: () => import('./features/workflow-editor/components/admin-users/admin-users.component').then(m => m.AdminUsersComponent)
      },
      { path: '', redirectTo: 'users', pathMatch: 'full' }
    ]
  },
  {
    path: 'notifications',
    canActivate: [authGuard],
    loadComponent: () => import('./features/workflow-editor/components/notifications-center/notifications-center.component').then(m => m.NotificationsCenterComponent)
  },
  { path: '**', redirectTo: '/dashboard' }
];
