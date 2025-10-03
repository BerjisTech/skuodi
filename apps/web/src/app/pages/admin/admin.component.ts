import { Component } from '@angular/core';
import { NgFor } from '@angular/common';

@Component({
  standalone: true,
  selector: 'app-admin-page',
  imports: [NgFor],
  templateUrl: './admin.component.html',
})
export class AdminComponent {
  readonly panels = [
    { title: 'Spaces', description: 'Overview of all active spaces and usage.' },
    { title: 'LiveKit', description: 'Monitor current sessions and bitrate health.' },
    { title: 'Storage', description: 'Track uploads stored in S3-compatible backend.' },
  ];
}
