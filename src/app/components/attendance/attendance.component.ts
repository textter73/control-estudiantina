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
  searchTerm: string = ''; // Para buscar usuarios
  showQuickActions: boolean = true; // Para mostrar acciones rápidas
  attendanceStats: any = { // Estadísticas en tiempo real
    presente: 0,
    escuela: 0,
    enfermedad: 0,
    falta: 0,
    total: 0
  };

  attendanceTypes = [
    { value: 'ensayo', label: '🎵 Ensayo', icon: '🎵' },
    { value: 'evento', label: '🎉 Evento', icon: '🎉' },
    { value: 'misa dominical', label: '⛪ Misa Dominical', icon: '⛪' }
  ];
  
  statusOptions = [
    { value: 'presente', label: 'Presente', icon: '✅', color: 'success' },
    { value: 'escuela', label: 'Escuela', icon: '📚', color: 'warning' },
    { value: 'enfermedad', label: 'Enfermedad', icon: '🤒', color: 'info' },
    { value: 'falta', label: 'Falta', icon: '❌', color: 'danger' }
  ];

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
      // Filtrar usuarios que no están desactivados
      this.users = users.filter(user => !user.deleted);
      this.initializeAttendanceRecords();
    });
  }

  initializeAttendanceRecords() {
    this.attendanceRecords = this.users.map(user => ({
      userId: user.uid,
      userName: user.name,
      status: 'presente'
    }));
    this.updateStats();
  }

  updateAttendanceStatus(userId: string, status: string) {
    const record = this.attendanceRecords.find(r => r.userId === userId);
    if (record) {
      record.status = status;
      this.updateStats();
    }
  }

  getUserStatus(userId: string): string {
    const record = this.attendanceRecords.find(r => r.userId === userId);
    return record?.status || 'presente';
  }

  // Nuevos métodos para mejorar la experiencia
  updateStats() {
    this.attendanceStats = {
      presente: this.attendanceRecords.filter(r => r.status === 'presente').length,
      escuela: this.attendanceRecords.filter(r => r.status === 'escuela').length,
      enfermedad: this.attendanceRecords.filter(r => r.status === 'enfermedad').length,
      falta: this.attendanceRecords.filter(r => r.status === 'falta').length,
      total: this.attendanceRecords.length
    };
  }

  getFilteredUsers() {
    if (!this.searchTerm) return this.users;
    return this.users.filter(user => 
      user.name.toLowerCase().includes(this.searchTerm.toLowerCase())
    );
  }

  // Acciones rápidas para marcar a todos
  markAllAs(status: string) {
    this.attendanceRecords.forEach(record => {
      record.status = status;
    });
    this.updateStats();
  }

  getStatusIcon(status: string): string {
    const statusObj = this.statusOptions.find(s => s.value === status);
    return statusObj?.icon || '❓';
  }

  getStatusColor(status: string): string {
    const statusObj = this.statusOptions.find(s => s.value === status);
    return statusObj?.color || 'secondary';
  }

  getPercentage(status: string): number {
    if (this.attendanceStats.total === 0) return 0;
    return Math.round((this.attendanceStats[status] / this.attendanceStats.total) * 100);
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