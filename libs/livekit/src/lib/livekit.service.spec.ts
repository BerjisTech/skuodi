import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LivekitClientService } from './livekit.service';

describe('LivekitClientService', () => {
  let service: LivekitClientService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [LivekitClientService],
    });
    service = TestBed.inject(LivekitClientService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('requests a token when joining', async () => {
    const promise = service.join('space-id', { audio: false });
    const req = httpMock.expectOne('/rtc/token');
    expect(req.request.method).toBe('POST');
    req.flush({ url: 'wss://example', token: 'fake' });
    await expectAsync(promise).toBeResolved();
    httpMock.verify();
  });
});
