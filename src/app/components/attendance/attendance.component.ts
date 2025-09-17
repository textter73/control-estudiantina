import { Component, OnInit } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-attendance',
  templateUrl: './attendance.component.html',
  styleUrls: ['./attendance.component.css']
})
export class AttendanceComponent implements OnInit {
  users: any[] = [];
  attendanceType: string = '';
  attendanceDate: string = '';
  attendanceRecords: any[] = [];

  attendanceTypes = ['ensayo', 'evento', 'misa dominical'];
  statusOptions = ['presente', 'escuela', 'enfermedad', 'falta'];

  constructor(
    private firestore: AngularFirestore,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadUsers();
    this.attendanceDate = new Date().toISOString().split('T')[0];
    this.setDateLimits();
  }

  setDateLimits() {
    const today = new Date();
    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(today.getDate() - 7);
    
    const dateInput = document.getElementById('attendanceDate') as HTMLInputElement;
    if (dateInput) {
      dateInput.min = oneWeekAgo.toISOString().split('T')[0];
      dateInput.max = today.toISOString().split('T')[0];
    }
  }

  loadUsers() {
    this.firestore.collection('users').valueChanges().subscribe((users: any[]) => {
      this.users = users;
      this.initializeAttendanceRecords();
    });
  }

  initializeAttendanceRecords() {
    this.attendanceRecords = this.users.map(user => ({
      userId: user.uid,
      userName: user.name,
      status: 'presente'
    }));
  }

  updateAttendanceStatus(userId: string, status: string) {
    const record = this.attendanceRecords.find(r => r.userId === userId);
    if (record) {
      record.status = status;
    }
  }

  getUserStatus(userId: string): string {
    const record = this.attendanceRecords.find(r => r.userId === userId);
    return record?.status || 'presente';
  }

  isValidDate(dateString: string): boolean {
    const selectedDate = new Date(dateString);
    const today = new Date();
    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(today.getDate() - 7);
    
    return selectedDate >= oneWeekAgo && selectedDate <= today;
  }

  async saveAttendance() {
    if (!this.attendanceType || !this.attendanceDate) {
      Swal.fire({
        icon: 'warning',
        title: 'Campos requeridos',
        text: 'Selecciona el tipo de asistencia y la fecha'
      });
      return;
    }

    if (!this.isValidDate(this.attendanceDate)) {
      Swal.fire({
        icon: 'error',
        title: 'Fecha no válida',
        text: 'Solo puedes registrar asistencia de una semana atrás hasta hoy'
      });
      return;
    }

    try {
      const attendanceData = {
        type: this.attendanceType,
        date: this.attendanceDate,
        records: this.attendanceRecords,
        createdAt: new Date(),
        createdBy: 'current-user-id'
      };

      await this.firestore.collection('attendance').add(attendanceData);
      
      Swal.fire({
        icon: 'success',
        title: 'Asistencia guardada',
        text: 'La asistencia se ha registrado correctamente',
        timer: 2000,
        showConfirmButton: false
      }).then(() => {
        this.router.navigate(['/dashboard']);
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo guardar la asistencia'
      });
    }
  }

  resetForm() {
    this.attendanceType = '';
    this.attendanceDate = new Date().toISOString().split('T')[0];
    this.initializeAttendanceRecords();
  }
}