import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { AdminComponent } from './components/admin/admin.component';
import { AttendanceComponent } from './components/attendance/attendance.component';
import { AttendanceTrackingComponent } from './components/attendance-tracking/attendance-tracking.component';
import { AttendanceSummaryComponent } from './components/attendance-summary/attendance-summary.component';
import { EventManagementComponent } from './components/event-management/event-management.component';
import { EventDetailsComponent } from './components/event-details/event-details.component';
import { AngularFireModule } from '@angular/fire/compat';
import { AngularFireAuthModule } from '@angular/fire/compat/auth';
import { AngularFirestoreModule } from '@angular/fire/compat/firestore';
import { firebaseConfig } from '../environments/firebase.config';
import { TransportManagementComponent } from './components/transport-management/transport-management.component';
import { TicketSalesComponent } from './components/ticket-sales/ticket-sales.component';
import { FinancialManagementComponent } from './components/financial-management/financial-management.component';
import { PaymentRequestsComponent } from './components/payment-requests/payment-requests.component';
import { SongbookComponent } from './components/songbook/songbook.component';
import { SongbookListComponent } from './components/songbook-list/songbook-list.component';
import { SongbookService } from './services/songbook.service';
import { RoleService } from './services/role.service';
import { DocumentoControlComponent } from './components/documento-control/documento-control.component';
import { MisDocumentosComponent } from './components/mis-documentos/mis-documentos.component';
import { InventoryManagementComponent } from './components/inventory-management/inventory-management.component';
import { SupplyRequestComponent } from './components/supply-request/supply-request.component';
import { MemberEvaluationComponent } from './components/member-evaluation/member-evaluation.component';
import { InsumoService } from './services/insumo.service';
import { UserEvaluationService } from './services/user-evaluation.service';

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    RegisterComponent,
    DashboardComponent,
    AdminComponent,
    AttendanceComponent,
    AttendanceTrackingComponent,
    AttendanceSummaryComponent,
    EventManagementComponent,
    EventDetailsComponent,
    TransportManagementComponent,
    TicketSalesComponent,
    FinancialManagementComponent,
    PaymentRequestsComponent,
    SongbookComponent,
    SongbookListComponent,
    DocumentoControlComponent,
    MisDocumentosComponent,
    InventoryManagementComponent,
    SupplyRequestComponent,
    MemberEvaluationComponent
  ],
  imports: [
    BrowserModule,
    CommonModule,
    FormsModule,
    AppRoutingModule,
    AngularFireModule.initializeApp(firebaseConfig),
    AngularFireAuthModule,
    AngularFirestoreModule
  ],
  providers: [SongbookService, InsumoService, UserEvaluationService],
  bootstrap: [AppComponent]
})
export class AppModule { }