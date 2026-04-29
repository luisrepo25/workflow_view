import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ActiveEditor {
  userId: string;
  userName: string;
}

@Component({
  selector: 'app-user-indicator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="user-indicator">
      @if (activeEditors().length > 0) {
        <div class="editors-list">
          <h4>Editando:</h4>
          <div class="editors">
            @for (editor of activeEditors(); track editor.userId) {
              <div class="editor-badge" [title]="editor.userName">
                <span class="avatar">{{ getInitials(editor.userName) }}</span>
                <span class="name">{{ editor.userName }}</span>
              </div>
            }
          </div>
        </div>
      } @else {
        <div class="no-editors">
          <p>Sin otros editores activos</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .user-indicator {
      padding: 1rem;
      background: #f8f9fa;
      border-radius: 4px;
    }

    .editors-list h4 {
      margin: 0 0 0.5rem 0;
      font-size: 0.875rem;
      color: #666;
    }

    .editors {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .editor-badge {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem;
      background: white;
      border: 1px solid #ddd;
      border-radius: 20px;
      font-size: 0.875rem;
    }

    .avatar {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #667eea;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: bold;
    }

    .no-editors {
      color: #999;
      font-size: 0.875rem;
      text-align: center;
      padding: 1rem;
    }

    .no-editors p {
      margin: 0;
    }
  `]
})
export class UserIndicatorComponent {
  activeEditors = input<ActiveEditor[]>([]);

  getInitials(name: string): string {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
}
