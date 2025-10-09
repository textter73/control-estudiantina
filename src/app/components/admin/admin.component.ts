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
  availableProfiles = ['administrador', 'finanzas', 'asistencia', 'agenda', 'transporte', 'editor-canciones'];
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
      'editor-canciones': 'Puede editar letras e instrumentación de canciones'
    };
  }

  async loadUsers() {
    this.firestore.collection('users').valueChanges().subscribe((users: any[]) => {
      this.users = users;
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
}