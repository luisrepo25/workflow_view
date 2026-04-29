import { Component, ChangeDetectionStrategy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavbarComponent],
  template: `
    @if (authService.isAuthenticated()) {
      <app-navbar />
      <div class="app-container">
        <main class="app-content">
          <router-outlet />
        </main>
      </div>
    } @else {
      <router-outlet />
    }
  `,
  styles: [`
    :host {
      display: block;
      height: 100vh;
      overflow: hidden;
    }

    .app-container {
      display: flex;
      height: calc(100vh - 65px); /* Adjusted for typical navbar height */
      width: 100%;
    }

    .app-content {
      flex: 1;
      width: 100%;
      overflow-y: auto;
      background: #f8f9fa;
      padding: 1.5rem;
      box-sizing: border-box;
    }
  `]
})
export class AppComponent implements OnInit {
  authService = inject(AuthService);

  ngOnInit(): void {
    // Check if user is already authenticated
    if (this.authService.isAuthenticated()) {
      console.log('User already authenticated:', this.authService.currentUser());
    }
  }
}
