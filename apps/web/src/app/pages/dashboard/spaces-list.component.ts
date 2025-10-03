import { AsyncPipe, DatePipe, NgFor, NgIf } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SpacesService } from '../../core/services/spaces.service';

@Component({
  standalone: true,
  selector: 'app-spaces-list',
  imports: [AsyncPipe, NgFor, NgIf, ReactiveFormsModule, RouterLink, DatePipe],
  templateUrl: './spaces-list.component.html',
})
export class SpacesListComponent implements OnInit {
  private readonly spaces = inject(SpacesService);
  private readonly fb = inject(FormBuilder);
  readonly spaces$ = this.spaces.spaces$;

  readonly form = this.fb.nonNullable.group({ name: ['', Validators.required] });

  ngOnInit() {
    this.spaces.loadSpaces().subscribe();
  }

  create() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.spaces.createSpace(this.form.getRawValue()).subscribe(() => {
      this.form.reset();
    });
  }
}
