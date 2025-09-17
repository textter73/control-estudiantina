import { Component, OnInit } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  user: any = null;
  userProfile: any = null;
  attendancePercentage: number = 0;
  totalAttendances: number = 0;
  presentAttendances: number = 0;
  participationPercentage: number = 0;
  participationAttendances: number = 0;
  attendanceStats = {
    presente: 0,
    escuela: 0,
    enfermedad: 0,
    falta: 0
  };

  getPercentage(count: number): number {
    return this.totalAttendances > 0 ? Math.round((count / this.totalAttendances) * 100) : 0;
  }

  misaStats = {
    asistidas: 0,
    faltas: 0,
    total: 0,
    percentage: 0
  };

  get isAdmin(): boolean {
    return this.userProfile?.profiles?.includes('administrador') || false;
  }

  get canManageAttendance(): boolean {
    return this.userProfile?.profiles?.includes('administrador') || 
           this.userProfile?.profiles?.includes('asistencia') || false;
  }

  constructor(
    private afAuth: AngularFireAuth,
    private firestore: AngularFirestore,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.afAuth.authState.subscribe(async (user) => {
      if (user) {
        this.user = user;
        const userDoc = await this.firestore.collection('users').doc(user.uid).get().toPromise();
        this.userProfile = userDoc?.data();
        this.loadAttendanceData();
      } else {
        this.router.navigate(['/']);
      }
    });
  }

  async loadAttendanceData() {
    if (!this.user) return;
    
    this.firestore.collection('attendance').valueChanges().subscribe((attendances: any[]) => {
      let totalCount = 0;
      let presentCount = 0;
      
      let participationCount = 0;
      const stats = { presente: 0, escuela: 0, enfermedad: 0, falta: 0 };
      
      attendances.forEach(attendance => {
        const userRecord = attendance.records?.find((record: any) => record.userId === this.user.uid);
        if (userRecord) {
          totalCount++;
          if (userRecord.status === 'presente') {
            presentCount++;
          }
          if (['presente', 'escuela', 'enfermedad'].includes(userRecord.status)) {
            participationCount++;
          }
          
          // Contar estadísticas por estado
          if (stats.hasOwnProperty(userRecord.status)) {
            stats[userRecord.status as keyof typeof stats]++;
          }
        }
      });
      
      this.attendanceStats = stats;
      
      // Calcular estadísticas de misa dominical
      let misaAsistidas = 0;
      let misaTotal = 0;
      
      attendances.forEach(attendance => {
        if (attendance.type === 'misa dominical') {
          const userRecord = attendance.records?.find((record: any) => record.userId === this.user.uid);
          if (userRecord) {
            misaTotal++;
            if (['presente', 'escuela', 'enfermedad'].includes(userRecord.status)) {
              misaAsistidas++;
            }
          }
        }
      });
      
      this.misaStats = {
        asistidas: misaAsistidas,
        faltas: misaTotal - misaAsistidas,
        total: misaTotal,
        percentage: misaTotal > 0 ? Math.round((misaAsistidas / misaTotal) * 100) : 0
      };
      
      this.totalAttendances = totalCount;
      this.presentAttendances = presentCount;
      this.participationAttendances = participationCount;
      this.attendancePercentage = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;
      this.participationPercentage = totalCount > 0 ? Math.round((participationCount / totalCount) * 100) : 0;
    });
  }

  logout() {
    this.afAuth.signOut().then(() => {
      this.router.navigate(['/']);
    });
  }

  goToTracking() {
    this.router.navigate(['/attendance-tracking']);
  }
}