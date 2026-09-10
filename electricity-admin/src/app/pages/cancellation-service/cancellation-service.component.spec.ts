import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CancellationServiceComponent } from './cancellation-service.component';

describe('CancellationServiceComponent', () => {
  let component: CancellationServiceComponent;
  let fixture: ComponentFixture<CancellationServiceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CancellationServiceComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CancellationServiceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
