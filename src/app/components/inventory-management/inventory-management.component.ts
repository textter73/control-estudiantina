import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { InsumoService } from '../../services/insumo.service';
import { AuthService } from '../../services/auth.service';
import { Insumo, SolicitudInsumo, CategoriaInsumo, EstadoSolicitud, MovimientoInventario } from '../../models/insumo.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-inventory-management',
  templateUrl: './inventory-management.component.html',
  styleUrls: ['./inventory-management.component.css']
})
export class InventoryManagementComponent implements OnInit {

  // Propiedades principales
  insumos: Insumo[] = [];
  solicitudes: SolicitudInsumo[] = [];
  movimientos: MovimientoInventario[] = [];
  
  // Filtros y búsqueda
  filtroCategoria: string = '';
  filtroBusqueda: string = '';
  filtroEstadoSolicitud: string = '';
  
  // Modal y formularios
  showInsumoModal: boolean = false;
  showSolicitudModal: boolean = false;
  editingInsumo: Insumo | null = null;
  selectedSolicitud: SolicitudInsumo | null = null;
  
  // Nuevo insumo
  nuevoInsumo: Insumo = {
    nombre: '',
    categoria: CategoriaInsumo.OTROS,
    descripcion: '',
    cantidadDisponible: 0,
    cantidadMinima: 0,
    costoUnitario: 0,
    proveedor: '',
    fechaCreacion: new Date(),
    fechaActualizacion: new Date(),
    activo: true
  };
  
  // Enums para el template
  categorias = Object.values(CategoriaInsumo);
  estadosSolicitud = Object.values(EstadoSolicitud);
  
  // Tab activo
  activeTab: string = 'insumos';
  
  // Usuario actual
  currentUser: any;

  constructor(
    private insumoService: InsumoService,
    private authService: AuthService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.authService.afAuth.currentUser.then(user => {
      this.currentUser = user;
    });
    this.loadData();
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
    this.loadSolicitudes();
    this.loadMovimientos();
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

  loadSolicitudes(): void {
    this.insumoService.getSolicitudes().subscribe(
      solicitudes => {
        this.solicitudes = solicitudes;
      },
      error => {
        console.error('Error al cargar solicitudes:', error);
        Swal.fire('Error', 'No se pudieron cargar las solicitudes', 'error');
      }
    );
  }

  loadMovimientos(): void {
    this.insumoService.getMovimientos().subscribe(
      movimientos => {
        this.movimientos = movimientos;
      },
      error => {
        console.error('Error al cargar movimientos:', error);
      }
    );
  }

  // === GESTIÓN DE INSUMOS ===

  get insumosFiltrados(): Insumo[] {
    return this.insumos.filter(insumo => {
      const matchCategoria = !this.filtroCategoria || insumo.categoria === this.filtroCategoria;
      const matchBusqueda = !this.filtroBusqueda || 
        insumo.nombre.toLowerCase().includes(this.filtroBusqueda.toLowerCase()) ||
        (insumo.descripcion && insumo.descripcion.toLowerCase().includes(this.filtroBusqueda.toLowerCase()));
      
      return matchCategoria && matchBusqueda;
    });
  }

  openInsumoModal(insumo?: Insumo): void {
    if (insumo) {
      this.editingInsumo = insumo;
      this.nuevoInsumo = { ...insumo };
    } else {
      this.editingInsumo = null;
      this.nuevoInsumo = {
        nombre: '',
        categoria: CategoriaInsumo.OTROS,
        descripcion: '',
        cantidadDisponible: 0,
        cantidadMinima: 0,
        costoUnitario: 0,
        proveedor: '',
        fechaCreacion: new Date(),
        fechaActualizacion: new Date(),
        activo: true
      };
    }
    this.showInsumoModal = true;
  }

  closeInsumoModal(): void {
    this.showInsumoModal = false;
    this.editingInsumo = null;
  }

  saveInsumo(): void {
    if (!this.nuevoInsumo.nombre || this.nuevoInsumo.costoUnitario < 0) {
      Swal.fire('Error', 'Por favor complete todos los campos requeridos', 'error');
      return;
    }

    if (this.editingInsumo) {
      // Editar insumo existente
      this.insumoService.updateInsumo(this.editingInsumo.id!, this.nuevoInsumo).then(() => {
        Swal.fire('Éxito', 'Insumo actualizado correctamente', 'success');
        this.closeInsumoModal();
      }).catch(error => {
        console.error('Error al actualizar insumo:', error);
        Swal.fire('Error', 'No se pudo actualizar el insumo', 'error');
      });
    } else {
      // Crear nuevo insumo
      this.insumoService.addInsumo(this.nuevoInsumo).then(() => {
        Swal.fire('Éxito', 'Insumo creado correctamente', 'success');
        this.closeInsumoModal();
      }).catch(error => {
        console.error('Error al crear insumo:', error);
        Swal.fire('Error', 'No se pudo crear el insumo', 'error');
      });
    }
  }

  deleteInsumo(insumo: Insumo): void {
    Swal.fire({
      title: '¿Está seguro?',
      text: `¿Desea eliminar el insumo "${insumo.nombre}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.insumoService.deleteInsumo(insumo.id!).then(() => {
          Swal.fire('Eliminado', 'El insumo ha sido eliminado', 'success');
        }).catch(error => {
          console.error('Error al eliminar insumo:', error);
          Swal.fire('Error', 'No se pudo eliminar el insumo', 'error');
        });
      }
    });
  }

  ajustarInventario(insumo: Insumo): void {
    Swal.fire({
      title: 'Ajustar Inventario',
      text: `Cantidad actual: ${insumo.cantidadDisponible}`,
      input: 'number',
      inputValue: insumo.cantidadDisponible,
      showCancelButton: true,
      confirmButtonText: 'Ajustar',
      cancelButtonText: 'Cancelar',
      preConfirm: (nuevaCantidad) => {
        if (nuevaCantidad < 0) {
          Swal.showValidationMessage('La cantidad no puede ser negativa');
          return false;
        }
        return nuevaCantidad;
      }
    }).then((result) => {
      if (result.isConfirmed) {
        const nuevaCantidad = parseInt(result.value);
        Swal.fire({
          title: 'Motivo del ajuste',
          input: 'text',
          inputPlaceholder: 'Ingrese el motivo del ajuste',
          showCancelButton: true,
          confirmButtonText: 'Confirmar',
          cancelButtonText: 'Cancelar'
        }).then((motivoResult) => {
          if (motivoResult.isConfirmed) {
            // Obtener el nombre real del usuario antes de hacer el ajuste
            this.getUserName().then(nombreUsuario => {
              this.insumoService.ajustarInventario(
                insumo.id!,
                nuevaCantidad,
                motivoResult.value || 'Ajuste manual',
                this.currentUser.uid,
                nombreUsuario
              ).then(() => {
                Swal.fire('Éxito', 'Inventario ajustado correctamente', 'success');
              }).catch(error => {
                console.error('Error al ajustar inventario:', error);
                Swal.fire('Error', 'No se pudo ajustar el inventario', 'error');
              });
            });
          }
        });
      }
    });
  }

  // === GESTIÓN DE SOLICITUDES ===

  get solicitudesFiltradas(): SolicitudInsumo[] {
    return this.solicitudes.filter(solicitud => {
      const matchEstado = !this.filtroEstadoSolicitud || solicitud.estado === this.filtroEstadoSolicitud;
      return matchEstado;
    });
  }

  getSolicitudesPendientes(): number {
    return this.solicitudes.filter(solicitud => solicitud.estado === EstadoSolicitud.PENDIENTE).length;
  }

  openSolicitudModal(solicitud: SolicitudInsumo): void {
    this.selectedSolicitud = solicitud;
    this.showSolicitudModal = true;
  }

  closeSolicitudModal(): void {
    this.showSolicitudModal = false;
    this.selectedSolicitud = null;
  }

  aprobarSolicitud(solicitud: SolicitudInsumo): void {
    Swal.fire({
      title: 'Aprobar Solicitud',
      text: `¿Aprobar la solicitud de ${solicitud.cantidadSolicitada} ${solicitud.nombreInsumo} para ${solicitud.nombreUsuario}?`,
      input: 'textarea',
      inputPlaceholder: 'Comentarios (opcional)',
      showCancelButton: true,
      confirmButtonText: 'Aprobar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#28a745'
    }).then((result) => {
      if (result.isConfirmed) {
        this.insumoService.aprobarSolicitud(solicitud.id!, solicitud, result.value).then(() => {
          Swal.fire('Éxito', 'Solicitud aprobada correctamente', 'success');
          this.closeSolicitudModal();
        }).catch(error => {
          console.error('Error al aprobar solicitud:', error);
          Swal.fire('Error', 'No se pudo aprobar la solicitud', 'error');
        });
      }
    });
  }

  rechazarSolicitud(solicitud: SolicitudInsumo): void {
    Swal.fire({
      title: 'Rechazar Solicitud',
      text: `¿Rechazar la solicitud de ${solicitud.cantidadSolicitada} ${solicitud.nombreInsumo} para ${solicitud.nombreUsuario}?`,
      input: 'textarea',
      inputPlaceholder: 'Motivo del rechazo',
      inputValidator: (value) => {
        if (!value) {
          return 'Debe especificar el motivo del rechazo';
        }
        return null;
      },
      showCancelButton: true,
      confirmButtonText: 'Rechazar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc3545'
    }).then((result) => {
      if (result.isConfirmed) {
        this.insumoService.rechazarSolicitud(solicitud.id!, result.value).then(() => {
          Swal.fire('Éxito', 'Solicitud rechazada', 'success');
          this.closeSolicitudModal();
        }).catch(error => {
          console.error('Error al rechazar solicitud:', error);
          Swal.fire('Error', 'No se pudo rechazar la solicitud', 'error');
        });
      }
    });
  }

  marcarComoEntregada(solicitud: SolicitudInsumo): void {
    Swal.fire({
      title: 'Marcar como Entregada',
      text: `¿Confirmar la entrega de ${solicitud.cantidadSolicitada} ${solicitud.nombreInsumo} a ${solicitud.nombreUsuario}?`,
      showCancelButton: true,
      confirmButtonText: 'Confirmar Entrega',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#17a2b8'
    }).then((result) => {
      if (result.isConfirmed) {
        this.insumoService.entregarSolicitud(solicitud.id!).then(() => {
          Swal.fire('Éxito', 'Solicitud marcada como entregada', 'success');
          this.closeSolicitudModal();
        }).catch(error => {
          console.error('Error al marcar como entregada:', error);
          Swal.fire('Error', 'No se pudo marcar como entregada', 'error');
        });
      }
    });
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

  getUserDisplayName(nombreCompleto: string): string {
    if (!nombreCompleto) return 'Usuario';
    
    // Ya no necesitamos extraer del email porque ahora guardamos el nombre real
    // Pero mantenemos la lógica por compatibilidad con datos existentes
    if (nombreCompleto.includes('@')) {
      return nombreCompleto.split('@')[0];
    }
    
    return nombreCompleto;
  }

  getStatusClass(estado: string): string {
    switch (estado) {
      case 'pendiente': return 'badge-pendiente';
      case 'aprobada': return 'badge-aprobada';
      case 'rechazada': return 'badge-rechazada';
      case 'entregada': return 'badge-entregada';
      default: return 'badge-secondary';
    }
  }

  getMovementTypeClass(tipo: string): string {
    switch (tipo) {
      case 'entrada': return 'badge-entrada';
      case 'salida': return 'badge-salida';
      case 'ajuste': return 'badge-ajuste';
      default: return 'badge-secondary';
    }
  }
}