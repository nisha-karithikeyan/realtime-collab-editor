import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { AuthActions } from '../../../core/auth/store/auth.actions';
import { selectResetError, selectResetRequestStatus } from '../../../core/auth/store/auth.selectors';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss',
})
export class ForgotPasswordComponent {
  private fb = inject(FormBuilder);
  private store = inject(Store);

  status = toSignal(this.store.select(selectResetRequestStatus), { initialValue: 'idle' as const });
  error = toSignal(this.store.select(selectResetError), { initialValue: null });

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  get isLoading() {
    return this.status() === 'loading';
  }

  get isSent() {
    return this.status() === 'sent';
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.store.dispatch(AuthActions.passwordResetRequested({ email: this.form.getRawValue().email }));
  }
}
