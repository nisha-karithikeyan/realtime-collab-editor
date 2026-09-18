import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { AuthActions } from '../../../core/auth/store/auth.actions';
import { selectAuthError, selectAuthStatus } from '../../../core/auth/store/auth.selectors';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private store = inject(Store);

  status = toSignal(this.store.select(selectAuthStatus), { initialValue: 'idle' as const });
  error = toSignal(this.store.select(selectAuthError), { initialValue: null });

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  get isLoading() {
    return this.status() === 'loading';
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password, name } = this.form.getRawValue();
    this.store.dispatch(AuthActions.registerSubmitted({ email, password, name }));
  }
}
