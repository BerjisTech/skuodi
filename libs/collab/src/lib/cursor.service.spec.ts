import { TestBed } from '@angular/core/testing';
import { CursorService } from './cursor.service';

describe('CursorService', () => {
  it('should be created', () => {
    const service = TestBed.inject(CursorService);
    expect(service).toBeTruthy();
  });
});
