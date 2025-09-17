import { Component, OnInit } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Router } from '@angular/router';

@Component({
  selector: 'app-attendance-tracking',
  templateUrl: './attendance-tracking.component.html',
  styleUrls: ['./attendance-tracking.component.css']
})
export class AttendanceTrackingComponent implements OnInit {
  user: any = null;
  currentDate = new Date();
  currentMonth = this.currentDate.getMonth();
  currentYear = this.currentDate.getFullYear();
  calendarDays: any[] = [];
  attendanceData: any[] = [];
  
  monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  selectedDate: any = null;
  showModal = false;

  constructor(
    private firestore: AngularFirestore,
    private afAuth: AngularFireAuth,
    private router: Router
  ) {}

  ngOnInit() {
    this.afAuth.authState.subscribe(user => {
      if (user) {
        this.user = user;
        this.loadAttendanceData();
        this.generateCalendar();
      } else {
        this.router.navigate(['/']);
      }
    });
  }

  loadAttendanceData() {
    this.firestore.collection('attendance').valueChanges().subscribe((attendances: any[]) => {
      this.attendanceData = attendances.filter(attendance => {
        const userRecord = attendance.records?.find((record: any) => record.userId === this.user.uid);
        return userRecord !== undefined;
      });
      this.generateCalendar();
    });
  }

  generateCalendar() {
    const firstDay = new Date(this.currentYear, this.currentMonth, 1);
    const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    this.calendarDays = [];
    
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      
      const attendanceInfo = this.getAttendanceForDate(date);
      
      this.calendarDays.push({
        date: date,
        day: date.getDate(),
        isCurrentMonth: date.getMonth() === this.currentMonth,
        isToday: this.isToday(date),
        attendance: attendanceInfo
      });
    }
  }

  getAttendanceForDate(date: Date): any {
    const dateStr = date.toISOString().split('T')[0];
    const events = [];
    
    for (let attendance of this.attendanceData) {
      if (attendance.date === dateStr) {
        const userRecord = attendance.records?.find((record: any) => record.userId === this.user.uid);
        if (userRecord) {
          events.push({
            status: userRecord.status,
            type: attendance.type
          });
        }
      }
    }
    return events.length > 0 ? events : null;
  }

  isToday(date: Date): boolean {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  previousMonth() {
    if (this.currentMonth === 0) {
      this.currentMonth = 11;
      this.currentYear--;
    } else {
      this.currentMonth--;
    }
    this.generateCalendar();
  }

  nextMonth() {
    if (this.currentMonth === 11) {
      this.currentMonth = 0;
      this.currentYear++;
    } else {
      this.currentMonth++;
    }
    this.generateCalendar();
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'presente': return 'status-presente';
      case 'escuela': return 'status-escuela';
      case 'enfermedad': return 'status-enfermedad';
      case 'falta': return 'status-falta';
      default: return '';
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'presente': return '✅';
      case 'escuela': return '🏫';
      case 'enfermedad': return '🩺';
      case 'falta': return '❌';
      default: return '';
    }
  }

  onDateClick(day: any) {
    if (day.attendance) {
      this.selectedDate = day;
      this.showModal = true;
    }
  }

  getEventTypeText(type: string): string {
    switch (type) {
      case 'ensayo': return 'Ensayo';
      case 'evento': return 'Evento';
      case 'misa dominical': return 'Misa Dominical';
      default: return type;
    }
  }

  closeModal() {
    this.showModal = false;
    this.selectedDate = null;
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'presente': return 'Presente';
      case 'escuela': return 'Escuela';
      case 'enfermedad': return 'Enfermedad';
      case 'falta': return 'Falta';
      default: return '';
    }
  }
}