import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AuthService } from '../../services/auth.service';

export interface DocumentoUsuario {
  id?: string;
  titulo: string;
  texto: string;
  version: number;
  fechaCreacion: any;
  fechaModificacion?: any;
  estado: 'pendiente' | 'entregado';
  fechaEntrega?: any;
}

@Component({
  selector: 'app-mis-documentos',
  templateUrl: './mis-documentos.component.html',
  styleUrls: ['./mis-documentos.component.css']
})
export class MisDocumentosComponent implements OnInit {
  documentosPendientes: DocumentoUsuario[] = [];
  documentosEntregados: DocumentoUsuario[] = [];
  loading = true;
  currentUser: any = null;
  userName: string = '';
  
  // Modal states
  showDocumentModal = false;
  selectedDocument: DocumentoUsuario | null = null;
  
  // Filtros
  showPendientes = true;
  showEntregados = true;

  constructor(
    private firestore: AngularFirestore,
    private authService: AuthService,
    private router: Router
  ) { }

  async ngOnInit() {
    this.currentUser = await this.authService.afAuth.currentUser;
    if (!this.currentUser) {
      this.router.navigate(['/login']);
      return;
    }
    
    await this.loadUserName();
    await this.loadUserDocuments();
  }

  async loadUserName() {
    try {
      const userDoc = await this.firestore.collection('users').doc(this.currentUser.uid).get().toPromise();
      if (userDoc && userDoc.exists) {
        const userData = userDoc.data() as any;
        this.userName = userData?.name || this.currentUser.displayName || 'Usuario';
      } else {
        this.userName = this.currentUser.displayName || 'Usuario';
      }
    } catch (error) {
      console.error('Error cargando nombre del usuario:', error);
      this.userName = this.currentUser.displayName || 'Usuario';
    }
  }

  async loadUserDocuments() {
    try {
      // Cargar solo documentos de versión actual donde el usuario esté en la lista de requeridos
      this.firestore.collection('documentos-fisicos', ref => 
        ref.where('esVersionActual', '==', true)
           .where('personasRequeridas', 'array-contains', this.currentUser.uid)
      ).valueChanges({ idField: 'id' }).subscribe({
        next: (docs: any[]) => {
          this.processUserDocuments(docs);
          this.loading = false;
        },
        error: (error) => {
          console.error('❌ Error loading user documents:', error);
          this.loading = false;
        }
      });
    } catch (error) {
      console.error('❌ Error en loadUserDocuments:', error);
      this.loading = false;
    }
  }

  processUserDocuments(docs: any[]) {
    this.documentosPendientes = [];
    this.documentosEntregados = [];

    docs.forEach(doc => {
      const documentoUsuario: DocumentoUsuario = {
        id: doc.id,
        titulo: doc.titulo,
        texto: doc.texto,
        version: doc.version,
        fechaCreacion: doc.fechaCreacion,
        fechaModificacion: doc.fechaModificacion,
        estado: doc.personasEntregadas.includes(this.currentUser.uid) ? 'entregado' : 'pendiente',
        fechaEntrega: doc.personasEntregadas.includes(this.currentUser.uid) ? doc.fechaModificacion : null
      };

      if (documentoUsuario.estado === 'pendiente') {
        this.documentosPendientes.push(documentoUsuario);
      } else {
        this.documentosEntregados.push(documentoUsuario);
      }
    });

    // Ordenar por fecha de creación
    this.documentosPendientes.sort((a, b) => b.fechaCreacion.seconds - a.fechaCreacion.seconds);
    this.documentosEntregados.sort((a, b) => b.fechaCreacion.seconds - a.fechaCreacion.seconds);
  }

  viewDocument(documento: DocumentoUsuario) {
    this.selectedDocument = documento;
    this.showDocumentModal = true;
  }

  closeDocumentModal() {
    this.showDocumentModal = false;
    this.selectedDocument = null;
  }

  toggleFilter(type: 'pendientes' | 'entregados') {
    if (type === 'pendientes') {
      this.showPendientes = !this.showPendientes;
    } else {
      this.showEntregados = !this.showEntregados;
    }
  }

  getTimeAgo(timestamp: any): string {
    if (!timestamp) return '';
    
    const now = new Date();
    const date = timestamp.toDate();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) {
      return 'Hoy';
    } else if (diffInDays === 1) {
      return 'Ayer';
    } else if (diffInDays < 7) {
      return `Hace ${diffInDays} días`;
    } else if (diffInDays < 30) {
      const weeks = Math.floor(diffInDays / 7);
      return `Hace ${weeks} semana${weeks > 1 ? 's' : ''}`;
    } else {
      const months = Math.floor(diffInDays / 30);
      return `Hace ${months} mes${months > 1 ? 'es' : ''}`;
    }
  }

  getPriorityClass(documento: DocumentoUsuario): string {
    if (documento.estado === 'entregado') return '';
    
    const now = new Date();
    const created = documento.fechaCreacion.toDate();
    const diffInDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays >= 7) {
      return 'priority-high';
    } else if (diffInDays >= 3) {
      return 'priority-medium';
    }
    return 'priority-normal';
  }

  // Método para formatear el texto del documento con saltos de línea
  formatDocumentText(texto: string): string {
    if (!texto) return '';
    
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
          .usuario-identificacion {
            margin-bottom: 20px;
            font-family: 'Times New Roman', serif;
          }
          .nombre-usuario {
            color: #189d98;
            font-weight: 700;
            text-decoration: underline;
          }
          .firma-section {
            margin-top: 100px;
            border-top: 1px solid #ccc;
            padding-top: 20px;
            text-align: center;
          }
          .firma-line {
            border-bottom: 2px solid #333;
            width: 300px;
            margin: 40px auto 10px auto;
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
            <p class="institucion">Estudiantina Tonantzin Guadalupe</p>
          </div>
        </div>
        
        <div class="fecha-documento">
          <strong>Fecha:</strong> ${this.selectedDocument.fechaCreacion.toDate().toLocaleDateString('es-ES')}
          <br><strong>Versión:</strong> ${this.selectedDocument.version}
        </div>
        
        <div class="contenido-principal">
          <div class="usuario-identificacion">
            <p><strong>Yo:</strong> <span class="nombre-usuario">${this.userName}</span>, integrante de la <strong>Estudiantina Tonantzin Guadalupe</strong>, por medio del presente documento:</p>
          </div>
          ${this.formatDocumentText(this.selectedDocument.texto)}
        </div>
        
        <div class="firma-section">
          <div class="firma-line"></div>
          <p><strong>Firma del Integrante</strong></p>
          <p><small>Fecha: _______________</small></p>
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
}