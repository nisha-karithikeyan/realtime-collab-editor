import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { AuthActions } from '../../../core/auth/store/auth.actions';
import { selectResetError, selectResetConfirmStatus } from '../../../core/auth/store/auth.selectors';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
})
export class ResetPasswordComponent {
  private fb = inject(FormBuilder);
  private store = inject(Store);
  private route = inject(ActivatedRoute);

  private uid = this.route.snapshot.queryParamMap.get('uid');
  private token = this.route.snapshot.queryParamMap.get('token');
  linkIsMissingParams = !this.uid || !this.token;

  status = toSignal(this.store.select(selectResetConfirmStatus), { initialValue: 'idle' as const });
  error = toSignal(this.store.select(selectResetError), { initialValue: null });

  form = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  get isLoading() {
    return this.status() === 'loading';
  }

  submit(): void {
    if (this.form.invalid || !this.uid || !this.token) {
      this.form.markAllAsTouched();
      return;
    }
    this.store.dispatch(
      AuthActions.passwordResetConfirmed({
        uid: this.uid,
        token: this.token,
        new_password: this.form.getRawValue().password,
      }),
    );
  }
}
