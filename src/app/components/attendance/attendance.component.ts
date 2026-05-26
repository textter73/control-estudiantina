import { Component, OnInit, OnDestroy } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { Html5Qrcode } from 'html5-qrcode';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-attendance',
  templateUrl: './attendance.component.html',
  styleUrls: ['./attendance.component.css']
})
export class AttendanceComponent implements OnInit, OnDestroy {
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

  // Variables para escaneo QR
  showQrScanner: boolean = false;
  html5QrCode: Html5Qrcode | null = null;
  isScanning: boolean = false;
  lastScannedUserId: string = '';
  scanCooldown: boolean = false;

  // Variables para guardado automático
  currentSessionId: string | null = null;
  autoSaveEnabled: boolean = true;
  isSaving: boolean = false;
  lastSaved: Date | null = null;
  unsavedChanges: boolean = false;

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
    private router: Router,
    private notificationService: NotificationService
  ) {}

  async ngOnInit() {
    this.loadUsers();
    this.attendanceDate = new Date().toISOString().split('T')[0];
    this.setDateLimits();
    await this.loadDraftSession();
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
    this.firestore.collection('users').valueChanges().subscribe(async (users: any[]) => {
      // Filtrar usuarios que no están desactivados y excluir "Estudiantina Tonantzin Guadalupe"
      this.users = users.filter(user => 
        !user.deleted && 
        user.name !== 'Estudiantina Tonantzin Guadalupe'
      );
      
      // Si no hay sesión cargada, inicializar registros vacíos
      if (!this.currentSessionId) {
        this.initializeAttendanceRecords();
      } else {
        // Si hay sesión, actualizar con los nuevos usuarios manteniendo estados guardados
        await this.updateAttendanceRecordsWithSession();
      }
    });
  }

  initializeAttendanceRecords() {
    this.attendanceRecords = this.users.map(user => ({
      userId: user.uid,
      userName: user.name,
      status: 'falta',
      savedStatus: null,
      lastModified: null
    }));
    this.updateStats();
  }

  async selectType(value: string) {
    const wasNew = !this.currentSessionId;
    this.attendanceType = value;
    if (this.attendanceDate) {
      await this.initializeSession();
      
      if (this.currentSessionId && wasNew) {
        Swal.fire({
          icon: 'success',
          title: 'Sesión iniciada',
          text: 'Los cambios se guardarán automáticamente',
          timer: 2000,
          showConfirmButton: false,
          position: 'top-end',
          toast: true
        });
      }
    }
  }

  async onDateChange() {
    if (this.attendanceType && this.attendanceDate) {
      await this.initializeSession();
    }
  }

  async updateAttendanceStatus(userId: string, status: string) {
    const record = this.attendanceRecords.find(r => r.userId === userId);
    if (record) {
      record.status = status;
      record.lastModified = new Date();
      this.updateStats();
      this.unsavedChanges = true;
      
      // Auto-guardar si está habilitado
      if (this.autoSaveEnabled) {
        await this.autoSaveAttendance();
      }
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
  async markAllAs(status: string) {
    this.attendanceRecords.forEach(record => {
      record.status = status;
      record.lastModified = new Date();
    });
    this.updateStats();
    this.unsavedChanges = true;
    
    // Auto-guardar si está habilitado
    if (this.autoSaveEnabled) {
      await this.autoSaveAttendance();
    }
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
        status: 'completed',
        createdAt: new Date(),
        createdBy: 'current-user-id'
      };

      // Guardar en colección principal
      await this.firestore.collection('attendance').add(attendanceData);
      
      // Eliminar sesión temporal si existe
      if (this.currentSessionId) {
        await this.firestore.collection('attendance-sessions').doc(this.currentSessionId).delete();
      }

      // Enviar notificaciones a todos los usuarios registrados
      await this.sendAttendanceNotifications();
      
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

  async confirmDeleteDraft() {
    if (!this.currentSessionId) {
      // Si no hay sesión guardada, solo reiniciar
      this.resetFormData();
      return;
    }

    const result = await Swal.fire({
      title: '¿Eliminar asistencia guardada?',
      text: 'Se borrarán todos los datos guardados de esta sesión. Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      await this.deleteDraftSession();
    }
  }

  async deleteDraftSession() {
    if (this.currentSessionId) {
      try {
        await this.firestore.collection('attendance-sessions').doc(this.currentSessionId).delete();
        
        Swal.fire({
          icon: 'success',
          title: 'Asistencia eliminada',
          text: 'La sesión guardada ha sido eliminada',
          timer: 2000,
          showConfirmButton: false,
          position: 'top-end',
          toast: true
        });
        
        this.resetFormData();
      } catch (error) {
        console.error('Error al eliminar sesión:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo eliminar la sesión'
        });
      }
    }
  }

  resetFormData() {
    this.attendanceType = '';
    this.attendanceDate = new Date().toISOString().split('T')[0];
    this.currentSessionId = null;
    this.lastSaved = null;
    this.unsavedChanges = false;
    this.initializeAttendanceRecords();
  }

  // Métodos para guardado automático
  async loadDraftSession() {
    try {
      const snapshot = await this.firestore.collection('attendance-sessions', ref => 
        ref.where('status', '==', 'draft').limit(1)
      ).get().toPromise();
      
      if (!snapshot?.empty) {
        const doc = snapshot.docs[0];
        const sessionData = doc.data() as any;
        
        this.currentSessionId = doc.id;
        this.attendanceType = sessionData.type;
        this.attendanceDate = sessionData.date;
        this.lastSaved = sessionData.updatedAt?.toDate() || sessionData.createdAt?.toDate();
        
        // Cargar los registros guardados
        if (sessionData.records && this.users.length > 0) {
          this.attendanceRecords = sessionData.records.map((record: any) => ({
            ...record,
            savedStatus: record.status
          }));
          this.updateStats();
        }
        
        console.log('Sesión draft cargada:', doc.id);
        
        // Eliminar otras sesiones draft si existen
        await this.cleanupOldDraftSessions(doc.id);
        
        // Notificar al usuario
        setTimeout(() => {
          Swal.fire({
            icon: 'info',
            title: 'Sesión recuperada',
            text: `Se cargó tu asistencia de ${sessionData.type} del ${sessionData.date}`,
            timer: 3000,
            showConfirmButton: false,
            position: 'top-end',
            toast: true
          });
        }, 500);
      }
    } catch (error) {
      console.error('Error al cargar sesión draft:', error);
    }
  }
  
  async cleanupOldDraftSessions(currentId: string) {
    try {
      const snapshot = await this.firestore.collection('attendance-sessions', ref => 
        ref.where('status', '==', 'draft')
      ).get().toPromise();
      
      if (!snapshot?.empty) {
        const batch = this.firestore.firestore.batch();
        snapshot.docs.forEach(doc => {
          if (doc.id !== currentId) {
            batch.delete(doc.ref);
          }
        });
        await batch.commit();
        console.log('Sesiones draft antiguas eliminadas');
      }
    } catch (error) {
      console.error('Error al limpiar sesiones draft:', error);
    }
  }
  
  async updateAttendanceRecordsWithSession() {
    // Actualizar la lista de usuarios manteniendo los estados guardados
    const existingRecords = new Map(this.attendanceRecords.map(r => [r.userId, r]));
    
    this.attendanceRecords = this.users.map(user => {
      const existing = existingRecords.get(user.uid);
      if (existing) {
        return existing;
      }
      return {
        userId: user.uid,
        userName: user.name,
        status: 'falta',
        savedStatus: null,
        lastModified: null
      };
    });
    
    this.updateStats();
  }

  async initializeSession() {
    if (!this.attendanceType || !this.attendanceDate) return;
    
    try {
      // Primero eliminar otras sesiones draft si existen y no tenemos ID actual
      if (!this.currentSessionId) {
        await this.cleanupOldDraftSessions('');
      }
      
      const sessionData = {
        type: this.attendanceType,
        date: this.attendanceDate,
        records: this.attendanceRecords,
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      if (this.currentSessionId) {
        // Actualizar sesión existente
        await this.firestore.collection('attendance-sessions').doc(this.currentSessionId).update({
          ...sessionData,
          updatedAt: new Date()
        });
      } else {
        // Crear nueva sesión
        const docRef = await this.firestore.collection('attendance-sessions').add(sessionData);
        this.currentSessionId = docRef.id;
      }
      
      // Actualizar registros con estado guardado
      this.attendanceRecords.forEach(record => {
        record.savedStatus = record.status;
      });
      
      this.lastSaved = new Date();
      this.unsavedChanges = false;
      
    } catch (error) {
      console.error('Error al inicializar sesión:', error);
    }
  }

  async autoSaveAttendance() {
    if (!this.attendanceType || !this.attendanceDate) {
      return;
    }
    
    if (this.isSaving) return;
    
    this.isSaving = true;
    
    try {
      const sessionData = {
        type: this.attendanceType,
        date: this.attendanceDate,
        records: this.attendanceRecords,
        status: 'draft',
        updatedAt: new Date()
      };
      
      if (this.currentSessionId) {
        // Actualizar sesión existente
        await this.firestore.collection('attendance-sessions').doc(this.currentSessionId).update(sessionData);
      } else {
        // Crear nueva sesión
        const docRef = await this.firestore.collection('attendance-sessions').add({
          ...sessionData,
          createdAt: new Date()
        });
        this.currentSessionId = docRef.id;
      }
      
      // Actualizar registros con estado guardado
      this.attendanceRecords.forEach(record => {
        record.savedStatus = record.status;
      });
      
      this.lastSaved = new Date();
      this.unsavedChanges = false;
      
      console.log('Auto-guardado exitoso:', new Date().toLocaleTimeString());
      
    } catch (error) {
      console.error('Error al auto-guardar:', error);
    } finally {
      this.isSaving = false;
    }
  }

  getRecordStatus(userId: string): string {
    const record = this.attendanceRecords.find(r => r.userId === userId);
    if (!record) return 'pending';
    
    if (record.savedStatus === null) return 'pending';
    if (record.savedStatus === record.status) return 'saved';
    return 'modified';
  }

  getStatusIndicator(userId: string): string {
    const status = this.getRecordStatus(userId);
    if (status === 'saved') return '✓';
    if (status === 'modified') return '⚠';
    return '○';
  }

  toggleAutoSave() {
    this.autoSaveEnabled = !this.autoSaveEnabled;
    
    Swal.fire({
      icon: 'info',
      title: this.autoSaveEnabled ? 'Auto-guardado activado' : 'Auto-guardado desactivado',
      text: this.autoSaveEnabled ? 'Los cambios se guardarán automáticamente' : 'Deberás guardar manualmente',
      timer: 2000,
      showConfirmButton: false,
      position: 'top-end',
      toast: true
    });
  }

  // Métodos para escaneo QR
  async openQrScanner() {
    this.showQrScanner = true;
    setTimeout(() => {
      this.startQrScanner();
    }, 300);
  }

  async startQrScanner() {
    try {
      this.html5QrCode = new Html5Qrcode('qr-reader');
      
      await this.html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        (decodedText) => {
          this.onQrCodeScanned(decodedText);
        },
        (errorMessage) => {
          // Ignorar errores de escaneo (son normales mientras busca QR)
        }
      );
      
      this.isScanning = true;
    } catch (err) {
      console.error('Error al iniciar escáner:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error al iniciar cámara',
        text: 'No se pudo acceder a la cámara. Verifica los permisos.',
        confirmButtonColor: '#189d98'
      });
      this.closeQrScanner();
    }
  }

  async onQrCodeScanned(userId: string) {
    // Prevenir escaneos múltiples rápidos
    if (this.scanCooldown) return;
    
    this.scanCooldown = true;
    setTimeout(() => {
      this.scanCooldown = false;
    }, 2000);

    // Buscar usuario
    const user = this.users.find(u => u.uid === userId);
    
    if (!user) {
      // QR no válido o usuario no encontrado
      this.playErrorSound();
      Swal.fire({
        icon: 'error',
        title: 'Usuario no encontrado',
        text: 'El código QR no corresponde a ningún integrante',
        timer: 2000,
        showConfirmButton: false
      });
      return;
    }

    // Marcar asistencia como presente
    await this.updateAttendanceStatus(userId, 'presente');
    
    // Feedback visual y sonoro
    this.playSuccessSound();
    this.showScanSuccess(user.name);
    
    // El escáner permanece abierto para continuar escaneando
  }

  showScanSuccess(userName: string) {
    Swal.fire({
      icon: 'success',
      title: '✅ Asistencia registrada',
      text: `${userName} marcado como presente`,
      timer: 1500,
      showConfirmButton: false,
      backdrop: false,
      position: 'top-end',
      toast: true
    });
  }

  playSuccessSound() {
    const audio = new Audio();
    audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBCSPzvLTgjMGHm7A7+OZRQ0PVq/m3KxeDQ0/muP0xXEtBSuCzvLaizsIGmq97OihUBELTKXh8bllHAU0kdXvzXcsBS2AzPDajj0JGGm67+qiUxIPUajj8rdfHgU9k9bwznkqBSh+y+/ekUQLD1Wt5tyrWxcNP5zl87tkIQUjj87y1YU4BxxqwO7mnkwRDVGp5PO0aCAHNI/U8Mt8Mwg=';
    audio.play().catch(() => {});
  }

  playErrorSound() {
    const audio = new Audio();
    audio.src = 'data:audio/wav;base64,UklGRi4AAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoAAACAgICAgICAgICA';
    audio.play().catch(() => {});
  }

  async closeQrScanner() {
    if (this.html5QrCode && this.isScanning) {
      try {
        await this.html5QrCode.stop();
        this.html5QrCode.clear();
      } catch (err) {
        console.error('Error al detener escáner:', err);
      }
    }
    
    this.isScanning = false;
    this.showQrScanner = false;
    this.html5QrCode = null;
  }

  /**
   * Envía notificaciones a todos los usuarios cuya asistencia fue registrada
   */
  async sendAttendanceNotifications() {
    try {
      // Obtener descripción del tipo de asistencia
      const typeLabel = this.attendanceTypes.find(t => t.value === this.attendanceType)?.label || this.attendanceType;
      const date = new Date(this.attendanceDate).toLocaleDateString('es-MX', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });

      // Enviar notificación a cada usuario registrado
      for (const record of this.attendanceRecords) {
        const statusLabel = this.statusOptions.find(s => s.value === record.status)?.label || record.status;
        const statusIcon = this.statusOptions.find(s => s.value === record.status)?.icon || '';

        await this.notificationService.sendNotificationToUser(
          record.userId,
          `📋 Asistencia Registrada`,
          `${statusIcon} ${statusLabel} - ${typeLabel} del ${date}`
        );
      }
    } catch (error) {
      // Error al enviar notificaciones (no bloquea el guardado)
    }
  }

  ngOnDestroy() {
    // Limpiar escáner al destruir componente
    if (this.html5QrCode && this.isScanning) {
      this.html5QrCode.stop().catch(() => {});
    }
  }
}