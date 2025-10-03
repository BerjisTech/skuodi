import { AsyncPipe, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

@Component({
  standalone: true,
  selector: 'app-account-page',
  imports: [AsyncPipe, NgIf, ReactiveFormsModule],
  templateUrl: './account.component.html',
})
export class AccountComponent {
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly user$ = this.auth.user$;

  readonly form = this.fb.nonNullable.group({
    displayName: ['', Validators.required],
    avatarUrl: [''],
  });

  constructor() {
    this.user$.subscribe((user) => {
      if (user) {
        this.form.patchValue({ displayName: user.displayName, avatarUrl: user.avatarUrl ?? '' }, { emitEvent: false });
      }
    });
  }

  save() {
    // TODO: Wire to backend once profile endpoint exists.
  }
}
