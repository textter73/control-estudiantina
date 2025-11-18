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
    this.firestore.collection('users').valueChanges().subscribe((users: any[]) => {
      // Filtrar usuarios que no están marcados como eliminados
      this.users = users.filter(user => !user.deleted);
    });
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
      text: `¿Estás seguro de que quieres reactivar a ${userName}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, reactivar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#28a745'
    });

    if (result.isConfirmed) {
      try {
        const currentUser = await this.authService.afAuth.currentUser;
        await this.firestore.collection('users').doc(userId).update({
          deleted: false,
          reactivatedAt: new Date(),
          reactivatedBy: currentUser?.uid || 'admin'
        });

        Swal.fire({
          icon: 'success',
          title: 'Usuario reactivado',
          text: `${userName} ha sido reactivado en el sistema`,
          timer: 2000,
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

  // Variables para controlar la vista de usuarios
  showDeletedUsers = false;
  deletedUsers: any[] = [];

  toggleDeletedUsersView() {
    this.showDeletedUsers = !this.showDeletedUsers;
    if (this.showDeletedUsers) {
      this.loadDeletedUsers();
    }
  }

  async loadDeletedUsers() {
    this.firestore.collection('users').valueChanges().subscribe((users: any[]) => {
      // Filtrar solo usuarios que están marcados como eliminados
      this.deletedUsers = users.filter(user => user.deleted);
    });
  }
}