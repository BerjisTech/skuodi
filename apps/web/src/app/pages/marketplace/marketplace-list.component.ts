import { AsyncPipe, CurrencyPipe, NgFor, NgIf } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AssetsService } from '../../core/services/assets.service';

@Component({
  standalone: true,
  selector: 'app-marketplace-list',
  imports: [AsyncPipe, NgFor, NgIf, RouterLink, CurrencyPipe],
  templateUrl: './marketplace-list.component.html',
})
export class MarketplaceListComponent implements OnInit {
  private readonly assets = inject(AssetsService);
  readonly assets$ = this.assets.list();

  ngOnInit() {
    this.assets$.subscribe();
  }
}
