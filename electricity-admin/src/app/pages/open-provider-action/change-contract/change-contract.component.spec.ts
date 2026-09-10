import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChangeContractsComponent } from './change-contract.component';

describe('ChangeContractsComponent', () => {
  let component: ChangeContractsComponent;
  let fixture: ComponentFixture<ChangeContractsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChangeContractsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChangeContractsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
