import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TransportManagementComponent } from './transport-management.component';

describe('TransportManagementComponent', () => {
  let component: TransportManagementComponent;
  let fixture: ComponentFixture<TransportManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ TransportManagementComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TransportManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
