import { Component, OnInit } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { MaintenanceService } from '../../services/maintenance.service';
import { InstrumentMaintenance } from '../../models/maintenance.model';
import { UserProfile } from '../../services/role.service';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import Swal from 'sweetalert2';

export interface UserWithMaintenance extends UserProfile {
  maintenanceStatus?: 'vencido' | 'a-tiempo' | 'sin-mantenimiento';
  nextMaintenanceDate?: any;
}

@Component({
  selector: 'app-instrument-maintenance',
  templateUrl: './instrument-maintenance.component.html',
  styleUrls: ['./instrument-maintenance.component.css']
})
export class InstrumentMaintenanceComponent implements OnInit {
  usersWithInstruments: UserWithMaintenance[] = [];
  selectedUser: UserWithMaintenance | null = null;
  maintenances: InstrumentMaintenance[] = [];
  
  showModal = false;
  maintenanceForm: any = {};
  
  currentAdminEmail = '';

  constructor(
    private firestore: AngularFirestore,
    private maintenanceService: MaintenanceService,
    private afAuth: AngularFireAuth
  ) { }

  ngOnInit(): void {
    this.afAuth.authState.subscribe(user => {
      if (user) {
        this.currentAdminEmail = user.email || 'Admin';
      }
    });
    this.loadUsers();
  }

  loadUsers() {
    this.firestore.collection('users').valueChanges().subscribe((users: any[]) => {
      // Filtrar solo usuarios que tengan instrumento
      const baseUsers = users.filter(u => !!u.instrument) as UserWithMaintenance[];
      
      this.maintenanceService.getAllMaintenances().subscribe(allMaintenances => {
        // Encontrar el último mantenimiento para cada usuario
        baseUsers.forEach(user => {
          const userMaintenances = allMaintenances.filter(m => m.userId === user.uid);
          userMaintenances.sort((a, b) => {
            const dateA = a.maintenanceDate?.toDate ? a.maintenanceDate.toDate().getTime() : new Date(a.maintenanceDate).getTime();
            const dateB = b.maintenanceDate?.toDate ? b.maintenanceDate.toDate().getTime() : new Date(b.maintenanceDate).getTime();
            return dateB - dateA;
          });
          
          if (userMaintenances.length > 0) {
            const latest = userMaintenances[0];
            user.nextMaintenanceDate = latest.nextMaintenanceDate;
            user.maintenanceStatus = this.isMaintenanceExpired(latest.nextMaintenanceDate) ? 'vencido' : 'a-tiempo';
          } else {
            user.maintenanceStatus = 'sin-mantenimiento';
            user.nextMaintenanceDate = null;
          }
        });

        // Ordenar: primero los vencidos (por fecha más antigua), luego a-tiempo (por fecha más próxima), luego sin-mantenimiento
        this.usersWithInstruments = baseUsers.sort((a, b) => {
          const valA = a.maintenanceStatus === 'vencido' ? 0 : (a.maintenanceStatus === 'sin-mantenimiento' ? 2 : 1);
          const valB = b.maintenanceStatus === 'vencido' ? 0 : (b.maintenanceStatus === 'sin-mantenimiento' ? 2 : 1);
          
          if (valA !== valB) return valA - valB;
          
          // Si ambos están vencidos, el más antiguo va primero
          if (valA === 0 && a.nextMaintenanceDate && b.nextMaintenanceDate) {
            const dA = a.nextMaintenanceDate.toDate ? a.nextMaintenanceDate.toDate().getTime() : new Date(a.nextMaintenanceDate).getTime();
            const dB = b.nextMaintenanceDate.toDate ? b.nextMaintenanceDate.toDate().getTime() : new Date(b.nextMaintenanceDate).getTime();
            return dA - dB;
          }
          
          // Si ambos están a-tiempo, el que venza antes va primero
          if (valA === 1 && a.nextMaintenanceDate && b.nextMaintenanceDate) {
            const dA = a.nextMaintenanceDate.toDate ? a.nextMaintenanceDate.toDate().getTime() : new Date(a.nextMaintenanceDate).getTime();
            const dB = b.nextMaintenanceDate.toDate ? b.nextMaintenanceDate.toDate().getTime() : new Date(b.nextMaintenanceDate).getTime();
            return dA - dB;
          }
          
          return 0;
        });
        
        // Actualizar el selectedUser si estaba seleccionado
        if (this.selectedUser) {
          const updated = this.usersWithInstruments.find(u => u.uid === this.selectedUser?.uid);
          if (updated) this.selectedUser = updated;
        }
      });
    });
  }

  isMaintenanceExpired(date: any): boolean {
    if (!date) return false;
    const nextDate = date.toDate ? date.toDate() : new Date(date);
    const today = new Date();
    today.setHours(0,0,0,0);
    nextDate.setHours(0,0,0,0);
    return nextDate < today;
  }

  selectUser(user: UserWithMaintenance) {
    this.selectedUser = user;
    this.loadMaintenances(user.uid);
  }

  loadMaintenances(userId: string) {
    this.maintenanceService.getMaintenancesForUser(userId).subscribe(records => {
      this.maintenances = records;
    });
  }

  openMaintenanceModal() {
    if (!this.selectedUser) return;
    
    const today = new Date();
    const nextDate = new Date();
    nextDate.setMonth(today.getMonth() + 9); // +9 meses
    
    this.maintenanceForm = {
      maintenanceDate: today.toISOString().split('T')[0],
      description: '',
      cost: 0,
      nextMaintenanceDate: nextDate.toISOString().split('T')[0]
    };
    
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
  }

  async saveMaintenance() {
    if (!this.selectedUser) return;
    
    try {
      const record: InstrumentMaintenance = {
        userId: this.selectedUser.uid,
        userName: this.selectedUser.name,
        instrument: this.selectedUser.instrument || 'Sin especificar',
        maintenanceDate: new Date(this.maintenanceForm.maintenanceDate),
        description: this.maintenanceForm.description,
        cost: this.maintenanceForm.cost,
        nextMaintenanceDate: new Date(this.maintenanceForm.nextMaintenanceDate),
        registeredBy: this.currentAdminEmail,
        registeredAt: new Date()
      };

      await this.maintenanceService.addMaintenance(record);
      this.closeModal();
      Swal.fire({
        icon: 'success',
        title: 'Mantenimiento registrado',
        text: 'El mantenimiento se ha registrado correctamente.',
        confirmButtonColor: '#10b981'
      });
    } catch (error) {
      console.error('Error al registrar mantenimiento:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Ocurrió un error al registrar el mantenimiento.',
        confirmButtonColor: '#f56565'
      });
    }
  }
}
