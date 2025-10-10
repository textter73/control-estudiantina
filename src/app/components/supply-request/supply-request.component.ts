import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { InsumoService } from '../../services/insumo.service';
import { AuthService } from '../../services/auth.service';
import { Insumo, SolicitudInsumo, CategoriaInsumo, EstadoSolicitud } from '../../models/insumo.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-supply-request',
  templateUrl: './supply-request.component.html',
  styleUrls: ['./supply-request.component.css']
})
export class SupplyRequestComponent implements OnInit {

  // Propiedades principales
  insumos: Insumo[] = [];
  misSolicitudes: SolicitudInsumo[] = [];
  
  // Filtros y búsqueda
  filtroCategoria: string = '';
  filtroBusqueda: string = '';
  soloDisponibles: boolean = true;
  
  // Modal de solicitud
  showSolicitudModal: boolean = false;
  selectedInsumo: Insumo | null = null;
  cantidadSolicitada: number = 1;
  observaciones: string = '';
  
  // Tab activo
  activeTab: string = 'catalogo';
  
  // Usuario actual
  currentUser: any;
  
  // Enums para el template
  categorias = Object.values(CategoriaInsumo);
  estadosSolicitud = Object.values(EstadoSolicitud);

  constructor(
    private insumoService: InsumoService,
    private authService: AuthService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.authService.afAuth.currentUser.then(user => {
      this.currentUser = user;
      this.loadData();
    });
  }

  async getUserName(): Promise<string> {
    if (!this.currentUser) return 'Usuario desconocido';
    
    try {
      const userDoc = await this.authService.firestore.collection('users').doc(this.currentUser.uid).get().toPromise();
      const userData = userDoc?.data() as any;
      return userData?.name || this.currentUser.email || 'Usuario desconocido';
    } catch (error) {
      console.error('Error al obtener el nombre del usuario:', error);
      return this.currentUser.email || 'Usuario desconocido';
    }
  }

  loadData(): void {
    this.loadInsumos();
    this.loadMisSolicitudes();
  }

  loadInsumos(): void {
    this.insumoService.getInsumos().subscribe(
      insumos => {
        this.insumos = insumos;
      },
      error => {
        console.error('Error al cargar insumos:', error);
        Swal.fire('Error', 'No se pudieron cargar los insumos', 'error');
      }
    );
  }

  loadMisSolicitudes(): void {
    if (this.currentUser) {
      this.insumoService.getSolicitudesByUsuario(this.currentUser.uid).subscribe(
        solicitudes => {
          this.misSolicitudes = solicitudes;
        },
        error => {
          console.error('Error al cargar mis solicitudes:', error);
        }
      );
    }
  }

  // === CATÁLOGO DE INSUMOS ===

  get insumosFiltrados(): Insumo[] {
    return this.insumos.filter(insumo => {
      const matchCategoria = !this.filtroCategoria || insumo.categoria === this.filtroCategoria;
      const matchBusqueda = !this.filtroBusqueda || 
        insumo.nombre.toLowerCase().includes(this.filtroBusqueda.toLowerCase()) ||
        (insumo.descripcion && insumo.descripcion.toLowerCase().includes(this.filtroBusqueda.toLowerCase()));
      const matchDisponible = !this.soloDisponibles || insumo.cantidadDisponible > 0;
      
      return matchCategoria && matchBusqueda && matchDisponible;
    });
  }

  openSolicitudModal(insumo: Insumo): void {
    if (insumo.cantidadDisponible === 0) {
      Swal.fire('Sin Stock', 'Este insumo no tiene stock disponible', 'warning');
      return;
    }
    
    this.selectedInsumo = insumo;
    this.cantidadSolicitada = 1;
    this.observaciones = '';
    this.showSolicitudModal = true;
  }

  closeSolicitudModal(): void {
    this.showSolicitudModal = false;
    this.selectedInsumo = null;
    this.cantidadSolicitada = 1;
    this.observaciones = '';
  }

  calcularCostoTotal(): number {
    if (!this.selectedInsumo) return 0;
    return this.selectedInsumo.costoUnitario * this.cantidadSolicitada;
  }

  async enviarSolicitud(): Promise<void> {
    if (!this.selectedInsumo || !this.currentUser) {
      return;
    }

    if (this.cantidadSolicitada <= 0) {
      Swal.fire('Error', 'La cantidad debe ser mayor a 0', 'error');
      return;
    }

    if (this.cantidadSolicitada > this.selectedInsumo.cantidadDisponible) {
      Swal.fire('Error', 'No hay suficiente stock disponible', 'error');
      return;
    }

    // Obtener el nombre real del usuario
    const nombreUsuario = await this.getUserName();

    const solicitud: SolicitudInsumo = {
      usuarioId: this.currentUser.uid,
      nombreUsuario: nombreUsuario,
      insumoId: this.selectedInsumo.id!,
      nombreInsumo: this.selectedInsumo.nombre,
      cantidadSolicitada: this.cantidadSolicitada,
      fechaSolicitud: new Date(),
      estado: EstadoSolicitud.PENDIENTE,
      observaciones: this.observaciones ? this.observaciones.trim() : '',
      costoTotal: this.calcularCostoTotal()
    };

    this.insumoService.addSolicitud(solicitud).then(() => {
      Swal.fire({
        title: 'Solicitud Enviada',
        text: 'Tu solicitud ha sido enviada y está pendiente de aprobación',
        icon: 'success',
        confirmButtonColor: '#189d98'
      });
      this.closeSolicitudModal();
    }).catch(error => {
      console.error('Error al enviar solicitud:', error);
      Swal.fire('Error', 'No se pudo enviar la solicitud', 'error');
    });
  }

  // === MIS SOLICITUDES ===

  get misSolicitudesOrdenadas(): SolicitudInsumo[] {
    return this.misSolicitudes.sort((a, b) => 
      this.toDate(b.fechaSolicitud).getTime() - this.toDate(a.fechaSolicitud).getTime()
    );
  }

  getMisSolicitudesPendientes(): number {
    return this.misSolicitudes.filter(solicitud => solicitud.estado === EstadoSolicitud.PENDIENTE).length;
  }

  // === UTILIDADES ===

  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }

  getEstadoClass(estado: EstadoSolicitud): string {
    switch (estado) {
      case EstadoSolicitud.PENDIENTE:
        return 'badge-warning';
      case EstadoSolicitud.APROBADA:
        return 'badge-success';
      case EstadoSolicitud.RECHAZADA:
        return 'badge-danger';
      case EstadoSolicitud.ENTREGADA:
        return 'badge-info';
      default:
        return 'badge-secondary';
    }
  }

  getStockClass(insumo: Insumo): string {
    if (insumo.cantidadDisponible === 0) {
      return 'text-danger';
    } else if (insumo.cantidadDisponible <= insumo.cantidadMinima) {
      return 'text-warning';
    }
    return 'text-success';
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  }

  getEstadoIcon(estado: EstadoSolicitud): string {
    switch (estado) {
      case EstadoSolicitud.PENDIENTE:
        return 'fas fa-clock';
      case EstadoSolicitud.APROBADA:
        return 'fas fa-check';
      case EstadoSolicitud.RECHAZADA:
        return 'fas fa-times';
      case EstadoSolicitud.ENTREGADA:
        return 'fas fa-hand-holding';
      default:
        return 'fas fa-question';
    }
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  // Método para convertir Firebase Timestamp a Date
  toDate(timestamp: any): Date {
    if (!timestamp) return new Date();
    
    // Si ya es un objeto Date, lo devolvemos
    if (timestamp instanceof Date) {
      return timestamp;
    }
    
    // Si es un Timestamp de Firebase, lo convertimos
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    
    // Si tiene propiedades seconds y nanoseconds (Timestamp serializado)
    if (timestamp.seconds) {
      return new Date(timestamp.seconds * 1000);
    }
    
    // Como fallback, intentamos crear una fecha
    return new Date(timestamp);
  }
}