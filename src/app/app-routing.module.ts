import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { AdminComponent } from './components/admin/admin.component';
import { AttendanceComponent } from './components/attendance/attendance.component';
import { AttendanceTrackingComponent } from './components/attendance-tracking/attendance-tracking.component';
import { AttendanceSummaryComponent } from './components/attendance-summary/attendance-summary.component';
import { AuthGuard } from './guards/auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { AttendanceGuard } from './guards/attendance.guard';
import { EventGuard } from './guards/event.guard';
import { EventManagementComponent } from './components/event-management/event-management.component';
import { EventDetailsComponent } from './components/event-details/event-details.component';
import { TransportManagementComponent } from './components/transport-management/transport-management.component';
import { TicketSalesComponent } from './components/ticket-sales/ticket-sales.component';
import { FinancialManagementComponent } from './components/financial-management/financial-management.component';
import { PaymentRequestsComponent } from './components/payment-requests/payment-requests.component';
import { SongbookComponent } from './components/songbook/songbook.component';
import { SongbookListComponent } from './components/songbook-list/songbook-list.component';
import { SongEditorGuard } from './guards/song-editor.guard';
import { DocumentoControlComponent } from './components/documento-control/documento-control.component';
import { DocumentadorGuard } from './guards/documentador.guard';
import { MisDocumentosComponent } from './components/mis-documentos/mis-documentos.component';
import { InventoryManagementComponent } from './components/inventory-management/inventory-management.component';
import { SupplyRequestComponent } from './components/supply-request/supply-request.component';

const routes: Routes = [
  { path: '', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuard] },
  { path: 'admin', component: AdminComponent, canActivate: [AdminGuard] },
  { path: 'attendance', component: AttendanceComponent, canActivate: [AttendanceGuard] },
  { path: 'attendance-tracking', component: AttendanceTrackingComponent, canActivate: [AuthGuard] },
  { path: 'attendance-summary', component: AttendanceSummaryComponent, canActivate: [AttendanceGuard] },
  { path: 'event-management', component: EventManagementComponent, canActivate: [EventGuard] },
  { path: 'event-details/:id', component: EventDetailsComponent, canActivate: [AuthGuard] },
  { path: 'transport-management', component: TransportManagementComponent, canActivate: [AuthGuard] },
  { path: 'ticket-sales', component: TicketSalesComponent, canActivate: [AuthGuard] },
  { path: 'financial-management', component: FinancialManagementComponent, canActivate: [AuthGuard] },
  { path: 'payment-requests', component: PaymentRequestsComponent, canActivate: [AuthGuard] },
  { path: 'songbook', component: SongbookComponent, canActivate: [SongEditorGuard] },
  { path: 'songbook-list', component: SongbookListComponent, canActivate: [AuthGuard] },
  { path: 'documento-control', component: DocumentoControlComponent, canActivate: [DocumentadorGuard] },
  { path: 'mis-documentos', component: MisDocumentosComponent, canActivate: [AuthGuard] },
  { path: 'inventory-management', component: InventoryManagementComponent, canActivate: [AdminGuard] },
  { path: 'supply-request', component: SupplyRequestComponent, canActivate: [AuthGuard] },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }