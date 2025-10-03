import { AsyncPipe, CurrencyPipe, DatePipe, NgIf, UpperCasePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map, switchMap } from 'rxjs';
import { AssetsService } from '../../core/services/assets.service';

@Component({
  standalone: true,
  selector: 'app-marketplace-detail',
  imports: [AsyncPipe, NgIf, RouterLink, CurrencyPipe, UpperCasePipe, DatePipe],
  templateUrl: './marketplace-detail.component.html',
})
export class MarketplaceDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly assets = inject(AssetsService);

  readonly asset$ = this.route.paramMap.pipe(
    map((params) => params.get('id') ?? ''),
    switchMap((id) => this.assets.list().pipe(map((assets) => assets.find((asset) => asset.id === id))))
  );
}
