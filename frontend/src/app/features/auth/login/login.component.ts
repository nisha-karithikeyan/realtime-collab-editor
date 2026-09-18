import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { Store } from '@ngrx/store';
import { AuthActions } from '../../../core/auth/store/auth.actions';
import { selectAuthError, selectAuthStatus } from '../../../core/auth/store/auth.selectors';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private store = inject(Store);
  private route = inject(ActivatedRoute);

  status = toSignal(this.store.select(selectAuthStatus), { initialValue: 'idle' as const });
  error = toSignal(this.store.select(selectAuthError), { initialValue: null });
  justRegistered = this.route.snapshot.queryParamMap.get('registered') === '1';
  justReset = this.route.snapshot.queryParamMap.get('reset') === '1';

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  get isLoading() {
    return this.status() === 'loading';
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password } = this.form.getRawValue();
    this.store.dispatch(AuthActions.loginSubmitted({ email, password }));
  }
}
