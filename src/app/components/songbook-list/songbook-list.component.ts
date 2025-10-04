import { Component, OnInit } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { SongbookService } from '../../services/songbook.service';
import { AuthService } from '../../services/auth.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-songbook-list',
  templateUrl: './songbook-list.component.html',
  styleUrls: ['./songbook-list.component.css']
})
export class SongbookListComponent implements OnInit {
  songs: any[] = [];
  filteredSongs: any[] = [];
  categories: string[] = [];
  selectedSong: any = null;
  loading = true;
  isAdmin = false;
  searchTerm = '';
  selectedCategory = '';
  isEditing = false;
  editedStructure = '';
  editedInstrumentation = '';
  isSaving = false;

  constructor(
    private songbookService: SongbookService,
    private authService: AuthService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit() {
    this.songbookService.getSongs().subscribe((res: any) => {
      this.songs = res.map((doc: any) => ({ id: doc.payload.doc.id, ...doc.payload.doc.data() }));
      this.filteredSongs = [...this.songs];
      this.extractCategories();
      this.loading = false;
    });

    // Obtener el perfil del usuario actual
    this.authService.afAuth.authState.subscribe(async (user) => {
      if (user) {
        const userDoc = await this.authService.firestore.collection('users').doc(user.uid).get().toPromise();
        const userData = userDoc?.data() as any;

        this.isAdmin = userData?.profiles?.includes('administrador');
      } else {
        this.isAdmin = false;
      }
    });
  }

  extractCategories() {
    const uniqueCategories = [...new Set(this.songs.map(song => song.category))];
    this.categories = uniqueCategories.filter(category => category); // Filtrar valores vacíos
  }

  filterSongs() {
    let filtered = [...this.songs];

    // Filtrar por categoría
    if (this.selectedCategory) {
      filtered = filtered.filter(song => song.category === this.selectedCategory);
    }

    // Filtrar por texto de búsqueda
    if (this.searchTerm.trim()) {
      filtered = filtered.filter(song =>
        song.title.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        song.category.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        song.status.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
    }

    this.filteredSongs = filtered;
  }

  openSongDetail(song: any) {
    this.selectedSong = song;
    this.editedStructure = song.structure || '';
    this.editedInstrumentation = song.instrumentation || '';
    this.isEditing = false;
    document.body.style.overflow = 'hidden'; // Evitar scroll del fondo
  }

  closeSongDetail() {
    this.selectedSong = null;
    this.isEditing = false;
    this.editedStructure = '';
    this.editedInstrumentation = '';
    document.body.style.overflow = 'auto'; // Restaurar scroll
  }

  startEditing() {
    this.isEditing = true;
    this.editedStructure = this.selectedSong.structure || '';
    this.editedInstrumentation = this.selectedSong.instrumentation || '';
  }

  async cancelEditing() {
    // Verificar si hay cambios sin guardar
    const hasChanges = 
      this.editedStructure !== (this.selectedSong.structure || '') ||
      this.editedInstrumentation !== (this.selectedSong.instrumentation || '');

    if (hasChanges) {
      const result = await Swal.fire({
        title: '¿Descartar cambios?',
        text: 'Tienes cambios sin guardar. ¿Estás seguro de que quieres cancelar?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: '🗑️ Sí, descartar',
        cancelButtonText: '↩️ Seguir editando'
      });

      if (!result.isConfirmed) return;
    }

    this.isEditing = false;
    this.editedStructure = this.selectedSong.structure || '';
    this.editedInstrumentation = this.selectedSong.instrumentation || '';
  }

  async saveChanges() {
    if (!this.selectedSong || this.isSaving) return;

    // Mostrar confirmación antes de guardar
    const result = await Swal.fire({
      title: '¿Guardar cambios?',
      text: `Se actualizarán la letra e instrumentación de "${this.selectedSong.title}"`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#189d98',
      cancelButtonColor: '#6c757d',
      confirmButtonText: '💾 Sí, guardar',
      cancelButtonText: '❌ Cancelar'
    });

    if (!result.isConfirmed) return;

    this.isSaving = true;

    try {
      const updatedData = {
        structure: this.editedStructure,
        instrumentation: this.editedInstrumentation
      };

      await this.songbookService.updateSong(this.selectedSong.id, updatedData);
      
      // Actualizar la canción en la lista local
      this.selectedSong.structure = this.editedStructure;
      this.selectedSong.instrumentation = this.editedInstrumentation;
      
      // Actualizar también en la lista principal
      const songIndex = this.songs.findIndex(s => s.id === this.selectedSong.id);
      if (songIndex !== -1) {
        this.songs[songIndex] = { ...this.songs[songIndex], ...updatedData };
      }

      this.isEditing = false;
      
      Swal.fire({
        title: '¡Éxito!',
        text: 'Los cambios han sido guardados exitosamente',
        icon: 'success',
        confirmButtonColor: '#189d98',
        confirmButtonText: 'Continuar'
      });
    } catch (error) {
      console.error('Error al guardar cambios:', error);
      
      Swal.fire({
        title: 'Error',
        text: 'No se pudieron guardar los cambios. Por favor, intenta de nuevo.',
        icon: 'error',
        confirmButtonColor: '#dc3545',
        confirmButtonText: 'Intentar de nuevo'
      });
    } finally {
      this.isSaving = false;
    }
  }

  getYouTubeEmbedUrl(url: string): SafeResourceUrl {
    if (!url) return '';
    
    // Extraer el ID del video de diferentes formatos de URL de YouTube
    let videoId = '';
    
    if (url.includes('youtube.com/watch?v=')) {
      videoId = url.split('v=')[1].split('&')[0];
    } else if (url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1].split('?')[0];
    } else if (url.includes('youtube.com/embed/')) {
      videoId = url.split('embed/')[1].split('?')[0];
    }
    
    if (videoId) {
      // Agregar parámetros para permitir reproducción y controles
      const embedUrl = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${window.location.origin}&widget_referrer=${window.location.origin}`;
      return this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
    }
    
    return '';
  }
}