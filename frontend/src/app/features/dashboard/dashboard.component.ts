import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { AuthActions } from '../../core/auth/store/auth.actions';
import { selectCurrentUser } from '../../core/auth/store/auth.selectors';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, EmptyStateComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private store = inject(Store);

  user = toSignal(this.store.select(selectCurrentUser), { initialValue: null });

  logout(): void {
    this.store.dispatch(AuthActions.loggedOut());
  }
}
