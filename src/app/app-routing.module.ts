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
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }