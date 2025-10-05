import { AsyncPipe, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';

@Component({
  standalone: true,
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, NgIf, AsyncPipe],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class AppComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly user$ = this.auth.user$;

  constructor() {
    if (this.auth.token) {
      this.auth.me().subscribe();
    }
  }

  logout() {
    this.auth.logout();
    void this.router.navigate(['/']);
  }
}
