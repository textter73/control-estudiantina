import { Component, OnInit } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AuthService } from '../../services/auth.service';
import { RoleService } from '../../services/role.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css']
})
export class AdminComponent implements OnInit {
  users: any[] = [];
  onLeaveUsers: any[] = [];
  deletedUsers: any[] = [];
  activeView: 'active' | 'onLeave' | 'deleted' = 'active';
  showDeletedUsers = false;

  readonly leaveReasons: { [key: string]: string } = {
    'salud': '🩺 Salud / Enfermedad',
    'descanso': '⏸️ Descanso Temporal',
    'permiso': '📋 Permiso Personal / Estudios'
  };

  readonly rankLabels: { [key: string]: string } = {
    'jefe-de-tuna': '👑 Jefe de Tuna',
    'tuno': '🎖️ Tuno',
    'capa': '🧥 Capa',
    'pardillo-discipulo': '🎓 Pardillo Discípulo',
    'pardillo-aprendiz': '🌱 Pardillo Aprendiz',
    'aspirante': '✨ Aspirante'
  };

  availableProfiles = ['administrador', 'finanzas', 'asistencia', 'agenda', 'transporte', 'editor-canciones', 'documentador', 'insumos'];
  profileDescriptions: { [key: string]: string } = {};

  constructor(
    private firestore: AngularFirestore,
    private authService: AuthService,
    private roleService: RoleService
  ) {}

  ngOnInit() {
    this.loadUsers();
    this.profileDescriptions = {
      'integrante': 'Acceso básico - puede ver contenido',
      'administrador': 'Acceso completo al sistema',
      'finanzas': 'Gestión financiera y pagos',
      'asistencia': 'Control de asistencia',
      'agenda': 'Gestión de eventos',
      'transporte': 'Gestión de transporte',
      'editor-canciones': 'Puede editar letras e instrumentación de canciones',
      'documentador': 'Gestión de documentos y firmas digitales',
      'insumos': 'Gestión de inventario y solicitudes de insumos'
    };
  }

  async loadUsers() {
    this.firestore.collection('users').valueChanges().subscribe((allUsers: any[]) => {
      // Filtrar usuarios activos (no eliminados y no en permiso/descanso)
      this.users = allUsers.filter(user => !user.deleted && !user.onLeave);
      // Usuarios en permiso o descanso temporal (siguen activos en finanzas)
      this.onLeaveUsers = allUsers.filter(user => !user.deleted && user.onLeave);
      // Usuarios desactivados
      this.deletedUsers = allUsers.filter(user => user.deleted);
    });
  }

  setView(view: 'active' | 'onLeave' | 'deleted') {
    this.activeView = view;
    this.showDeletedUsers = view === 'deleted';
  }

  getLeaveReasonLabel(reason?: string): string {
    if (!reason) return '⏸️ En Permiso / Descanso';
    return this.leaveReasons[reason] || reason;
  }

  getRankLabel(rank?: string): string {
    if (!rank) return 'Sin rango asignado';
    return this.rankLabels[rank] || rank;
  }

  async assignRank(userId: string, userName: string, currentRank?: string) {
    const { value: selectedRank } = await Swal.fire({
      title: `Asignar Rango a ${userName}`,
      input: 'select',
      inputOptions: {
        '': '-- Sin rango --',
        ...this.rankLabels
      },
      inputValue: currentRank || '',
      showCancelButton: true,
      confirmButtonText: 'Guardar Rango',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#189d98'
    });

    if (selectedRank !== undefined) {
      try {
        await this.firestore.collection('users').doc(userId).update({
          rank: selectedRank || null,
          rankUpdatedAt: new Date()
        });
        Swal.fire({
          icon: 'success',
          title: 'Rango actualizado',
          text: `${userName}: ${this.getRankLabel(selectedRank)}`,
          timer: 2000,
          showConfirmButton: false
        });
      } catch (error) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo actualizar el rango'
        });
      }
    }
  }

  async setUserOnLeave(userId: string, userName: string) {
    const { value: selectedReason } = await Swal.fire({
      title: `Poner en permiso a ${userName}`,
      html: `<p style="color:#475569;font-size:0.92rem;margin-bottom:0.5rem;">
        El integrante <b>no aparecerá en pases de lista, evaluaciones ni estadísticas</b> mientras esté ausente, pero <b>mantendrá acceso a su cuenta y a Finanzas</b>.
      </p>`,
      input: 'select',
      inputOptions: this.leaveReasons,
      inputPlaceholder: 'Selecciona el motivo de ausencia',
      showCancelButton: true,
      confirmButtonText: 'Poner en Permiso',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#f59e0b',
      inputValidator: (value) => {
        if (!value) {
          return 'Debes seleccionar un motivo';
        }
        return null;
      }
    });

    if (selectedReason) {
      try {
        const currentUser = await this.authService.afAuth.currentUser;
        await this.firestore.collection('users').doc(userId).update({
          onLeave: true,
          leaveReason: selectedReason,
          onLeaveAt: new Date(),
          onLeaveBy: currentUser?.uid || 'admin'
        });

        Swal.fire({
          icon: 'success',
          title: 'Integrante en permiso',
          text: `${userName} fue marcado como "${this.getLeaveReasonLabel(selectedReason)}". Sigue activo en Finanzas.`,
          timer: 2600,
          showConfirmButton: false
        });
      } catch (error) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo actualizar el estado del integrante'
        });
      }
    }
  }

  async returnUserFromLeave(userId: string, userName: string) {
    const result = await Swal.fire({
      title: `¿Regresar a ${userName} como integrante activo?`,
      text: `Volverá a aparecer normalmente en los pases de lista, evaluaciones y estadísticas conservando todo su historial.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, regresar a activo',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#189d98'
    });

    if (result.isConfirmed) {
      try {
        const currentUser = await this.authService.afAuth.currentUser;
        await this.firestore.collection('users').doc(userId).update({
          onLeave: false,
          returnedFromLeaveAt: new Date(),
          returnedFromLeaveBy: currentUser?.uid || 'admin'
        });

        Swal.fire({
          icon: 'success',
          title: 'Integrante activo nuevamente',
          text: `${userName} ha regresado a las listas y estadísticas activas.`,
          timer: 2200,
          showConfirmButton: false
        });
      } catch (error) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo reactivar al integrante de su permiso'
        });
      }
    }
  }

  async assignProfile(userId: string, userName: string) {
    const { value: selectedProfile } = await Swal.fire({
      title: `Asignar perfil a ${userName}`,
      input: 'select',
      inputOptions: this.availableProfiles.reduce((options: any, profile: string) => {
        options[profile] = profile;
        return options;
      }, {}),
      showCancelButton: true,
      confirmButtonText: 'Asignar',
      cancelButtonText: 'Cancelar'
    });

    if (selectedProfile) {
      const result = await this.authService.addProfile(userId, selectedProfile);
      if (result.success) {
        Swal.fire({
          icon: 'success',
          title: 'Perfil asignado',
          text: `Perfil ${selectedProfile} asignado correctamente`,
          timer: 2000,
          showConfirmButton: false
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: result.error
        });
      }
    }
  }

  async removeProfile(userId: string, userName: string, userProfiles: string[]) {
    if (userProfiles.length <= 1) {
      Swal.fire({
        icon: 'warning',
        title: 'No se puede quitar',
        text: 'El usuario debe tener al menos un perfil'
      });
      return;
    }

    const { value: selectedProfile } = await Swal.fire({
      title: `Quitar perfil de ${userName}`,
      input: 'select',
      inputOptions: userProfiles.reduce((options: any, profile: string) => {
        options[profile] = profile;
        return options;
      }, {}),
      showCancelButton: true,
      confirmButtonText: 'Quitar',
      cancelButtonText: 'Cancelar'
    });

    if (selectedProfile) {
      const result = await this.authService.removeProfile(userId, selectedProfile);
      if (result.success) {
        Swal.fire({
          icon: 'success',
          title: 'Perfil removido',
          text: `Perfil ${selectedProfile} removido correctamente`,
          timer: 2000,
          showConfirmButton: false
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: result.error
        });
      }
    }
  }

  async deactivateUser(userId: string, userName: string) {
    const result = await Swal.fire({
      title: `¿Desactivar usuario?`,
      text: `¿Estás seguro de que quieres desactivar a ${userName}? El usuario no aparecerá en listados pero sus datos se conservarán.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, desactivar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d33'
    });

    if (result.isConfirmed) {
      try {
        const currentUser = await this.authService.afAuth.currentUser;
        await this.firestore.collection('users').doc(userId).update({
          deleted: true,
          deletedAt: new Date(),
          deletedBy: currentUser?.uid || 'admin'
        });

        Swal.fire({
          icon: 'success',
          title: 'Usuario desactivado',
          text: `${userName} ha sido desactivado del sistema`,
          timer: 2000,
          showConfirmButton: false
        });
      } catch (error) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo desactivar el usuario'
        });
      }
    }
  }

  async reactivateUser(userId: string, userName: string) {
    const result = await Swal.fire({
      title: `¿Reactivar usuario?`,
      text: `¿Estás seguro de que quieres reactivar a ${userName}? Se borrarán todas sus asistencias y empezará desde cero.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, reactivar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#28a745'
    });

    if (result.isConfirmed) {
      try {
        const currentUser = await this.authService.afAuth.currentUser;
        
        // Reactivar el usuario
        await this.firestore.collection('users').doc(userId).update({
          deleted: false,
          reactivatedAt: new Date(),
          reactivatedBy: currentUser?.uid || 'admin'
        });

        // Eliminar todas las asistencias del usuario
        const attendanceSnapshot = await this.firestore.collection('attendance').get().toPromise();
        const batch = this.firestore.firestore.batch();
        let attendancesUpdated = 0;

        attendanceSnapshot?.docs.forEach(doc => {
          const attendanceData = doc.data() as any;
          if (attendanceData.records && Array.isArray(attendanceData.records)) {
            const filteredRecords = attendanceData.records.filter((record: any) => record.userId !== userId);
            
            // Solo actualizar si se eliminó algún registro
            if (filteredRecords.length !== attendanceData.records.length) {
              batch.update(doc.ref, { records: filteredRecords });
              attendancesUpdated++;
            }
          }
        });

        // Ejecutar el batch para actualizar todas las asistencias
        await batch.commit();

        Swal.fire({
          icon: 'success',
          title: 'Usuario reactivado',
          text: `${userName} ha sido reactivado y se eliminaron ${attendancesUpdated} registros de asistencia`,
          timer: 3000,
          showConfirmButton: false
        });
      } catch (error) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo reactivar el usuario'
        });
      }
    }
  }

  toggleDeletedUsersView() {
    this.showDeletedUsers = !this.showDeletedUsers;
    this.activeView = this.showDeletedUsers ? 'deleted' : 'active';
  }
}