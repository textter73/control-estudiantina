import { Component, OnInit } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Router } from '@angular/router';

@Component({
  selector: 'app-attendance-summary',
  templateUrl: './attendance-summary.component.html',
  styleUrls: ['./attendance-summary.component.css']
})
export class AttendanceSummaryComponent implements OnInit {
  users: any[] = [];
  attendances: any[] = [];
  summaryData: any[] = [];
  filteredSummaryData: any[] = [];
  userProfile: any = null;
  searchTerm: string = '';

  constructor(
    private firestore: AngularFirestore,
    private afAuth: AngularFireAuth,
    private router: Router
  ) {}

  ngOnInit() {
    this.afAuth.authState.subscribe(async (user) => {
      if (user) {
        const userDoc = await this.firestore.collection('users').doc(user.uid).get().toPromise();
        this.userProfile = userDoc?.data();
        
        if (this.canViewSummary()) {
          this.loadData();
        } else {
          this.router.navigate(['/dashboard']);
        }
      } else {
        this.router.navigate(['/']);
      }
    });
  }

  canViewSummary(): boolean {
    return this.userProfile?.profiles?.includes('administrador') || 
           this.userProfile?.profiles?.includes('asistencia') || false;
  }

  loadData() {
    this.firestore.collection('users').valueChanges().subscribe((users: any[]) => {
      this.users = users;
      this.loadAttendances();
    });
  }

  loadAttendances() {
    this.firestore.collection('attendance').valueChanges().subscribe((attendances: any[]) => {
      this.attendances = attendances;
      this.calculateSummary();
    });
  }

  calculateSummary() {
    this.summaryData = this.users.map(user => {
      let totalEvents = 0;
      let presente = 0;
      let escuela = 0;
      let enfermedad = 0;
      let falta = 0;
      let misasDominicales = 0;
      let misasAsistidas = 0;

      this.attendances.forEach(attendance => {
        const userRecord = attendance.records?.find((record: any) => record.userId === user.uid);
        if (userRecord) {
          totalEvents++;
          
          switch (userRecord.status) {
            case 'presente': presente++; break;
            case 'escuela': escuela++; break;
            case 'enfermedad': enfermedad++; break;
            case 'falta': falta++; break;
          }

          if (attendance.type === 'misa dominical') {
            misasDominicales++;
            if (['presente', 'escuela', 'enfermedad'].includes(userRecord.status)) {
              misasAsistidas++;
            }
          }
        }
      });

      const participacion = totalEvents > 0 ? Math.round(((presente + escuela + enfermedad) / totalEvents) * 100) : 0;
      const asistenciaEfectiva = totalEvents > 0 ? Math.round((presente / totalEvents) * 100) : 0;
      const misasPercentage = misasDominicales > 0 ? Math.round((misasAsistidas / misasDominicales) * 100) : 0;

      return {
        name: user.name,
        email: user.email,
        totalEvents,
        presente,
        escuela,
        enfermedad,
        falta,
        participacion,
        asistenciaEfectiva,
        misasDominicales,
        misasAsistidas,
        misasPercentage
      };
    });

    this.summaryData.sort((a, b) => b.participacion - a.participacion);
    this.filteredSummaryData = [...this.summaryData];
  }

  getStatusClass(percentage: number): string {
    if (percentage >= 90) return 'excellent';
    if (percentage >= 75) return 'good';
    if (percentage >= 60) return 'regular';
    return 'poor';
  }

  onSearchChange() {
    if (!this.searchTerm.trim()) {
      this.filteredSummaryData = [...this.summaryData];
    } else {
      this.filteredSummaryData = this.summaryData.filter(user => 
        user.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
    }
  }
}