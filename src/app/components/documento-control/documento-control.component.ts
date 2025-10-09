import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AuthService } from '../../services/auth.service';
import firebase from 'firebase/compat/app';
import Swal from 'sweetalert2';

export interface DocumentoFisico {
  id?: string;
  titulo: string;
  texto: string;
  creadoPor: string;
  fechaCreacion: any;
  personasRequeridas: string[];
  personasEntregadas: string[];
  estado: 'pendiente' | 'completo';
  // Control de versiones
  version: number;
  versionAnterior?: string; // ID del documento de la versión anterior
  esVersionActual: boolean;
  historialCambios?: string; // Descripción de los cambios realizados
  fechaModificacion?: any;
  modificadoPor?: string;
}

@Component({
  selector: 'app-documento-control',
  templateUrl: './documento-control.component.html',
  styleUrls: ['./documento-control.component.css']
})
export class DocumentoControlComponent implements OnInit {
  documentos: DocumentoFisico[] = [];
  usuarios: any[] = [];
  loading = true;
  isAdmin = false;

  // Modal states
  showCreateModal = false;
  showViewModal = false;
  selectedDocument: DocumentoFisico | null = null;
  isCreating = false;

  // Formulario nuevo documento
  nuevoDocumento: Partial<DocumentoFisico> = {
    titulo: '',
    texto: '',
    personasRequeridas: []
  };

  // Buscador de usuarios
  searchTerm: string = '';
  filteredUsuarios: any[] = [];

  // Control de versiones
  showVersionModal = false;
  showEditModal = false;
  versiones: DocumentoFisico[] = [];
  documentoParaEditar: Partial<DocumentoFisico> = {};
  historialCambios: string = '';

  constructor(
    private firestore: AngularFirestore,
    private authService: AuthService,
    private router: Router
  ) { }

  async ngOnInit() {
    await this.checkAdminRole();
    
    if (this.isAdmin) {
      this.loadUsers();
      this.loadDocuments();
    } else {
      this.loading = false;
    }
  }

  async checkAdminRole() {
    try {
      const user = await this.authService.afAuth.currentUser;
      
      if (user) {
        const userDoc = await this.firestore.collection('users').doc(user.uid).get().toPromise();
        const userData = userDoc?.data() as any;
        
        this.isAdmin = userData?.profiles?.includes('administrador') || userData?.profiles?.includes('documentador');
      } else {
        this.isAdmin = false;
      }
    } catch (error) {
      console.error('❌ Error checking admin role:', error);
      this.isAdmin = false;
    }
  }

  loadUsers() {
    this.firestore.collection('users').valueChanges({ idField: 'uid' }).subscribe({
      next: (users: any[]) => {
        this.usuarios = users.sort((a, b) => a.name.localeCompare(b.name));
        this.filteredUsuarios = [...this.usuarios]; // Inicializar lista filtrada
      },
      error: (error) => {
        console.error('❌ Error loading users:', error);
      }
    });
  }

  loadDocuments() {
    // Timeout de seguridad
    const timeout = setTimeout(() => {
      this.loading = false;
    }, 10000); // 10 segundos
    
    this.firestore.collection('documentos-fisicos', ref => 
      ref.where('esVersionActual', '==', true)
    ).valueChanges({ idField: 'id' }).subscribe({
      next: (docs: any[]) => {
        clearTimeout(timeout);
        
        // Ordenar por fecha de creación en el cliente
        this.documentos = docs.sort((a, b) => {
          if (!a.fechaCreacion || !b.fechaCreacion) return 0;
          return b.fechaCreacion.seconds - a.fechaCreacion.seconds;
        });
        
        this.loading = false;
      },
      error: (error) => {
        clearTimeout(timeout);
        console.error('❌ Error loading documents:', error);
        this.loading = false;
      }
    });
  }

  openCreateModal() {
    this.nuevoDocumento = {
      titulo: '',
      texto: '',
      personasRequeridas: []
    };
    this.searchTerm = ''; // Limpiar búsqueda
    this.filteredUsuarios = [...this.usuarios]; // Resetear lista filtrada
    this.showCreateModal = true;
  }

  closeCreateModal() {
    this.showCreateModal = false;
    this.searchTerm = ''; // Limpiar búsqueda al cerrar
  }

  async createDocument() {
    if (!this.nuevoDocumento.titulo || !this.nuevoDocumento.texto) {
      Swal.fire({
        title: 'Datos Incompletos',
        text: 'Por favor completa el título y el texto del documento',
        icon: 'warning',
        confirmButtonColor: '#ffc107'
      });
      return;
    }

    this.isCreating = true;

    try {
      const currentUser = await this.authService.afAuth.currentUser;
      if (!currentUser) {
        this.isCreating = false;
        return;
      }

      const documentData: DocumentoFisico = {
        titulo: this.nuevoDocumento.titulo!,
        texto: this.nuevoDocumento.texto!,
        creadoPor: currentUser.uid,
        fechaCreacion: firebase.firestore.Timestamp.now(),
        personasRequeridas: this.nuevoDocumento.personasRequeridas || [],
        personasEntregadas: [],
        estado: 'pendiente',
        version: 1,
        esVersionActual: true,
        fechaModificacion: firebase.firestore.Timestamp.now(),
        modificadoPor: currentUser.uid
      };

      await this.firestore.collection('documentos-fisicos').add(documentData);

      await Swal.fire({
        title: '¡Documento creado!',
        text: 'El documento ha sido creado exitosamente',
        icon: 'success',
        confirmButtonColor: '#189d98'
      });

      this.closeCreateModal();

    } catch (error: any) {
      console.error('❌ Error creating document:', error);
      await Swal.fire({
        title: 'Error',
        text: 'Error al crear el documento: ' + (error?.message || 'Error desconocido'),
        icon: 'error',
        confirmButtonColor: '#dc3545'
      });
    } finally {
      this.isCreating = false;
    }
  }

  viewDocument(documento: DocumentoFisico) {
    this.selectedDocument = documento;
    this.showViewModal = true;
  }

  closeViewModal() {
    this.showViewModal = false;
    this.selectedDocument = null;
  }

  async toggleEntrega(documento: DocumentoFisico, usuarioId: string) {
    const yaEntregado = documento.personasEntregadas.includes(usuarioId);
    
    try {
      let nuevasEntregas;
      if (yaEntregado) {
        // Remover de entregadas
        nuevasEntregas = documento.personasEntregadas.filter(id => id !== usuarioId);
      } else {
        // Agregar a entregadas
        nuevasEntregas = [...documento.personasEntregadas, usuarioId];
      }

      // Calcular nuevo estado
      const nuevoEstado = nuevasEntregas.length === documento.personasRequeridas.length ? 'completo' : 'pendiente';

      await this.firestore.collection('documentos-fisicos').doc(documento.id).update({
        personasEntregadas: nuevasEntregas,
        estado: nuevoEstado
      });

      const accion = yaEntregado ? 'removido' : 'marcado como entregado';
      Swal.fire({
        title: 'Actualizado',
        text: `Documento ${accion}`,
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      });

    } catch (error: any) {
      console.error('Error updating delivery:', error);
      Swal.fire({
        title: 'Error',
        text: 'Error al actualizar la entrega',
        icon: 'error',
        confirmButtonColor: '#dc3545'
      });
    }
  }

  isUserSelected(userId: string): boolean {
    return this.nuevoDocumento.personasRequeridas?.includes(userId) || false;
  }

  onUserSelectionChange(userId: string, selected: boolean) {
    if (!this.nuevoDocumento.personasRequeridas) {
      this.nuevoDocumento.personasRequeridas = [];
    }

    if (selected) {
      if (!this.nuevoDocumento.personasRequeridas.includes(userId)) {
        this.nuevoDocumento.personasRequeridas.push(userId);
      }
    } else {
      this.nuevoDocumento.personasRequeridas = this.nuevoDocumento.personasRequeridas.filter(id => id !== userId);
    }
  }

  selectAllUsers() {
    this.nuevoDocumento.personasRequeridas = this.filteredUsuarios.map(user => user.uid);
  }

  deselectAllUsers() {
    this.nuevoDocumento.personasRequeridas = [];
  }

  // Método para filtrar usuarios basado en el término de búsqueda
  filterUsers() {
    if (!this.searchTerm.trim()) {
      this.filteredUsuarios = [...this.usuarios];
    } else {
      const term = this.searchTerm.toLowerCase();
      this.filteredUsuarios = this.usuarios.filter(user => 
        user.name.toLowerCase().includes(term) || 
        user.email.toLowerCase().includes(term)
      );
    }
  }

  // Método que se ejecuta cuando cambia el input de búsqueda
  onSearchChange() {
    this.filterUsers();
  }

  // Método para limpiar la búsqueda
  clearSearch() {
    this.searchTerm = '';
    this.filteredUsuarios = [...this.usuarios];
  }

  getUserName(userId: string): string {
    const user = this.usuarios.find(u => u.uid === userId);
    return user ? user.name : 'Usuario desconocido';
  }

  getEstadoClass(documento: DocumentoFisico): string {
    return documento.estado === 'completo' ? 'estado-completo' : 'estado-pendiente';
  }

  getProgresoEntrega(documento: DocumentoFisico): string {
    return `${documento.personasEntregadas.length}/${documento.personasRequeridas.length}`;
  }

  // Método para formatear el texto del documento con saltos de línea
  formatDocumentText(texto: string): string {
    if (!texto) return '';
    
    // Convertir saltos de línea a <br> y mantener espacios
    return texto
      .replace(/\n/g, '<br>')
      .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
      .replace(/  /g, '&nbsp;&nbsp;');
  }

  // Método para imprimir el documento
  printDocument() {
    if (!this.selectedDocument) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${this.selectedDocument.titulo}</title>
        <style>
          body { 
            font-family: 'Times New Roman', serif; 
            margin: 40px; 
            line-height: 1.8; 
            color: #333;
            background: white;
          }
          .documento-header { 
            text-align: center; 
            margin-bottom: 30px; 
            border-bottom: 2px solid #189d98;
            padding-bottom: 20px;
          }
          .escudo-imagen { 
            width: 80px; 
            height: 80px; 
            margin-bottom: 10px;
            border-radius: 50%;
            object-fit: cover;
            border: 2px solid #189d98;
          }
          .titulo-oficial h2 { 
            color: #189d98; 
            margin: 10px 0; 
            font-size: 24px;
            font-weight: 700;
            text-transform: uppercase;
          }
          }
          .institucion { 
            font-style: italic; 
            color: #666; 
            margin: 0;
          }
          .fecha-documento { 
            text-align: right; 
            margin: 20px 0; 
            font-weight: bold;
            font-size: 16px;
          }
          .contenido-principal { 
            margin: 30px 0; 
            min-height: 300px;
            text-align: justify;
            line-height: 1.8;
            font-family: 'Times New Roman', serif;
          }
          .seccion-firmas { 
            display: flex; 
            justify-content: space-between; 
            margin-top: 80px; 
          }
          .firma-izquierda, .firma-derecha { 
            width: 45%; 
            text-align: center; 
          }
          .linea-firma { 
            border-bottom: 2px solid #333; 
            margin-bottom: 10px; 
            height: 40px; 
          }
          @media print {
            body { margin: 20px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="documento-header">
          <img src="assets/estonantzin.jpeg" alt="Escudo Estudiantina" class="escudo-imagen">
          <div class="titulo-oficial">
            <h2>${this.selectedDocument.titulo}</h2>
            <p class="institucion">Estudiantina Tonantín Guadalupe</p>
          </div>
        </div>
        
        <div class="fecha-documento">
          <p><strong>Fecha:</strong> ${this.selectedDocument.fechaCreacion.toDate().toLocaleDateString('es-ES')}</p>
        </div>
        
        <div class="contenido-principal">
          ${this.formatDocumentText(this.selectedDocument.texto)}
        </div>
        
        <div class="seccion-firmas">
          <div class="firma-izquierda">
            <div class="linea-firma"></div>
            <p><strong>Firma del integrante</strong></p>
            <p><small>(si es mayor de edad)</small></p>
          </div>
          <div class="firma-derecha">
            <div class="linea-firma"></div>
            <p><strong>Nombre y firma del padre/tutor</strong></p>
            <p><small>(si es menor de edad)</small></p>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  // Navegar al dashboard
  goToDashboard() {
    this.router.navigate(['/dashboard']);
  }

  // Métodos para control de versiones
  async openEditModal(documento: DocumentoFisico) {
    this.selectedDocument = documento;
    this.documentoParaEditar = {
      titulo: documento.titulo,
      texto: documento.texto,
      personasRequeridas: [...documento.personasRequeridas]
    };
    this.historialCambios = '';
    this.showEditModal = true;
  }

  closeEditModal() {
    this.showEditModal = false;
    this.selectedDocument = null;
    this.documentoParaEditar = {};
    this.historialCambios = '';
  }

  async createNewVersion() {
    if (!this.selectedDocument || !this.historialCambios.trim()) {
      Swal.fire('Error', 'Debe describir los cambios realizados', 'error');
      return;
    }

    try {
      const currentUser = await this.authService.afAuth.currentUser;
      if (!currentUser) return;

      // Marcar la versión actual como no actual
      await this.firestore.collection('documentos-fisicos').doc(this.selectedDocument.id).update({
        esVersionActual: false
      });

      // Crear nueva versión
      const nuevaVersion: DocumentoFisico = {
        titulo: this.documentoParaEditar.titulo!,
        texto: this.documentoParaEditar.texto!,
        creadoPor: this.selectedDocument.creadoPor,
        fechaCreacion: this.selectedDocument.fechaCreacion,
        personasRequeridas: this.documentoParaEditar.personasRequeridas || [],
        personasEntregadas: this.selectedDocument.personasEntregadas,
        estado: this.selectedDocument.estado,
        version: this.selectedDocument.version + 1,
        versionAnterior: this.selectedDocument.id,
        esVersionActual: true,
        historialCambios: this.historialCambios,
        fechaModificacion: firebase.firestore.Timestamp.now(),
        modificadoPor: currentUser.uid
      };

      await this.firestore.collection('documentos-fisicos').add(nuevaVersion);

      Swal.fire('Éxito', 'Nueva versión creada exitosamente', 'success');
      this.closeEditModal();
      this.loadDocuments();
    } catch (error) {
      console.error('Error creando nueva versión:', error);
      Swal.fire('Error', 'Error al crear la nueva versión', 'error');
    }
  }

  async openVersionModal(documento: DocumentoFisico) {
    this.selectedDocument = documento;
    this.showVersionModal = true;
    await this.loadVersionHistory(documento);
  }

  closeVersionModal() {
    this.showVersionModal = false;
    this.selectedDocument = null;
    this.versiones = [];
  }

  async loadVersionHistory(documento: DocumentoFisico) {
    try {
      // Cargar todas las versiones de este documento
      const versiones: DocumentoFisico[] = [];
      
      // Agregar la versión actual
      versiones.push(documento);
      
      // Buscar versiones anteriores siguiendo la cadena
      let versionAnterior = documento.versionAnterior;
      while (versionAnterior) {
        const versionDoc = await this.firestore.collection('documentos-fisicos').doc(versionAnterior).get().toPromise();
        if (versionDoc && versionDoc.exists) {
          const data = versionDoc.data();
          if (data && typeof data === 'object') {
            const versionData = { id: versionDoc.id, ...data } as DocumentoFisico;
            versiones.push(versionData);
            versionAnterior = versionData.versionAnterior;
          } else {
            break;
          }
        } else {
          break;
        }
      }
      
      // Ordenar por versión descendente
      this.versiones = versiones.sort((a, b) => b.version - a.version);
    } catch (error) {
      console.error('Error cargando historial de versiones:', error);
    }
  }

  async revertToVersion(version: DocumentoFisico) {
    const result = await Swal.fire({
      title: '¿Revertir a esta versión?',
      text: `Se creará una nueva versión basada en la versión ${version.version}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, revertir',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        const currentUser = await this.authService.afAuth.currentUser;
        if (!currentUser) return;

        // Marcar la versión actual como no actual
        await this.firestore.collection('documentos-fisicos').doc(this.selectedDocument!.id).update({
          esVersionActual: false
        });

        // Crear nueva versión basada en la versión seleccionada
        const nuevaVersion: DocumentoFisico = {
          titulo: version.titulo,
          texto: version.texto,
          creadoPor: version.creadoPor,
          fechaCreacion: version.fechaCreacion,
          personasRequeridas: [...version.personasRequeridas],
          personasEntregadas: [...this.selectedDocument!.personasEntregadas],
          estado: this.selectedDocument!.estado,
          version: this.selectedDocument!.version + 1,
          versionAnterior: this.selectedDocument!.id,
          esVersionActual: true,
          historialCambios: `Revertido a versión ${version.version}`,
          fechaModificacion: firebase.firestore.Timestamp.now(),
          modificadoPor: currentUser.uid
        };

        await this.firestore.collection('documentos-fisicos').add(nuevaVersion);

        Swal.fire('Éxito', 'Documento revertido exitosamente', 'success');
        this.closeVersionModal();
        this.loadDocuments();
      } catch (error) {
        console.error('Error revirtiendo versión:', error);
        Swal.fire('Error', 'Error al revertir la versión', 'error');
      }
    }
  }

  getUserNameById(userId: string): string {
    const user = this.usuarios.find(u => u.uid === userId);
    return user ? user.name : 'Usuario desconocido';
  }
}