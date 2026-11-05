import { Component, OnInit, HostListener, OnDestroy } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { SongbookService } from '../../services/songbook.service';
import { AuthService } from '../../services/auth.service';
import { RoleService } from '../../services/role.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-songbook-list',
  templateUrl: './songbook-list.component.html',
  styleUrls: ['./songbook-list.component.css']
})
export class SongbookListComponent implements OnInit, OnDestroy {
  songs: any[] = [];
  filteredSongs: any[] = [];
  categories: string[] = [];
  selectedSong: any = null;
  loading = true;
  isAdmin = false;
  canEditSongs = false;
  searchTerm = '';
  selectedCategory: string | null = null;
  isEditing = false;
  songsByCategory: { [key: string]: any[] } = {};
  activeTab: 'index' | 'categories' = 'categories';
  modalActiveTab: 'lyrics' | 'learning' = 'lyrics';
  activeUsers: any[] = [];
  currentUserId: string | null = null;
  learningSearchTerm = '';
  learningFilter: 'all' | 'learned' | 'pending' = 'all';
  isLearningExpanded = true;
  selectedCategoriesForIndex: string[] = [];
  indexSortBy: 'number' | 'title' | 'category' = 'number';
  sortDirection: 'asc' | 'desc' = 'asc';
  editedOrderNumber: number | null = null;
  editedGeneralOrderNumber: number | null = null;
  editedStructure = '';
  editedInstrumentation = '';
  editedTitle = '';
  editedCategory = '';
  editedStatus = '';
  editedComposers = '';
  editedYoutubeLink = '';
  editedExcludeFromLearning = false;
  isSaving = false;
  isWatchingVideo = false;
  isVideoFloating = false;

  // Variables para Drag & Drop de ordenamiento (Administrador)
  draggedSong: any = null;
  dragOverSongId: string | null = null;
  dragDropPosition: 'before' | 'after' = 'before';
  dragContext: 'general' | 'category' = 'general';
  dragCategoryName: string | null = null;
  isReorderingSongs = false;

  // Variables para zoom de texto
  fontSize = 16; // Tamaño base en píxeles
  minFontSize = 12;
  maxFontSize = 24;

  // Variables para protección móvil
  private touchStartTime = 0;
  private touchCount = 0;
  private lastTouchTime = 0;
  private screenshotAttempts = 0;
  private powerButtonPresses = 0;
  private volumeDownPresses = 0;
  private isModalOpen = false;

  constructor(
    private songbookService: SongbookService,
    private authService: AuthService,
    private sanitizer: DomSanitizer,
    private roleService: RoleService
  ) { }

  ngOnInit() {
    // Cargar usuarios activos para control de aprendizaje
    this.loadActiveUsers();

    // Cargar canciones
    this.songbookService.getSongs().subscribe((res: any) => {
      this.songs = res.map((doc: any) => ({ id: doc.payload.doc.id, ...doc.payload.doc.data() }));
      this.filteredSongs = [...this.songs];
      this.extractCategories();
      this.organizeSongsByCategory();
      if (this.selectedSong) {
        const currentSelected = this.songs.find(s => s.id === this.selectedSong.id);
        if (currentSelected) {
          this.selectedSong = currentSelected;
        }
      }
      this.loading = false;
    });

    // Verificar permisos del usuario
    this.roleService.isAdmin().subscribe(isAdmin => {
      this.isAdmin = isAdmin;
    });

    this.roleService.canEditSongs().subscribe(canEdit => {
      this.canEditSongs = canEdit;
    });

    // Listener para detectar scroll y activar video flotante
    this.addScrollListener();

    // Obtener el perfil del usuario actual
    this.authService.afAuth.authState.subscribe(async (user) => {
      if (user) {
        this.currentUserId = user.uid;
        const userDoc = await this.authService.firestore.collection('users').doc(user.uid).get().toPromise();
        const userData = userDoc?.data() as any;

        this.isAdmin = userData?.profiles?.includes('administrador');
      } else {
        this.currentUserId = null;
        this.isAdmin = false;
      }
    });

    // Activar protecciones contra capturas de pantalla
    this.enableScreenshotProtection();

    // Activar protecciones específicas para móviles
    this.enableMobileScreenshotProtection();
  }

  ngOnDestroy() {
    // Limpiar event listeners
    this.removeMobileProtections();
    // Limpiar scroll listener
    window.removeEventListener('scroll', this.handleScroll.bind(this));
  }

  // Protección contra teclas de captura de pantalla
  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    // No aplicar protecciones si se está editando o viendo video
    if (this.isEditing || this.isWatchingVideo) {
      return true;
    }

    // Prevenir F12 (DevTools)
    if (event.key === 'F12') {
      event.preventDefault();
      this.showProtectionWarning();
      return false;
    }

    // Prevenir Ctrl+Shift+I (DevTools)
    if (event.ctrlKey && event.shiftKey && event.key === 'I') {
      event.preventDefault();
      this.showProtectionWarning();
      return false;
    }

    // Prevenir Ctrl+U (Ver código fuente)
    if (event.ctrlKey && event.key === 'u') {
      event.preventDefault();
      this.showProtectionWarning();
      return false;
    }

    // Prevenir Print Screen
    if (event.key === 'PrintScreen') {
      event.preventDefault();
      this.showProtectionWarning();
      return false;
    }

    // Prevenir Ctrl+P (Imprimir)
    if (event.ctrlKey && event.key === 'p') {
      event.preventDefault();
      this.showProtectionWarning();
      return false;
    }

    // Prevenir Ctrl+S (Guardar) - excepto si está editando
    if (event.ctrlKey && event.key === 's') {
      event.preventDefault();
      this.showProtectionWarning();
      return false;
    }

    return true;
  }

  // Protección contra clic derecho
  @HostListener('document:contextmenu', ['$event'])
  onRightClick(event: MouseEvent) {
    // Verificar si se está editando o viendo video
    if (this.isEditing || this.isWatchingVideo) {
      return true;
    }

    if (this.selectedSong) {
      event.preventDefault();
      event.stopPropagation();
      this.showProtectionWarning();
      return false;
    }
    return true;
  }

  // Protección contra selección de texto
  @HostListener('document:selectstart', ['$event'])
  onSelectStart(event: Event) {
    // Permitir selección si se está editando o viendo video
    if (this.isEditing || this.isWatchingVideo) {
      return true;
    }

    if (this.selectedSong) {
      event.preventDefault();
      return false;
    }
    return true;
  }

  private enableScreenshotProtection() {
    // Deshabilitar drag and drop
    document.addEventListener('dragstart', (e) => {
      // Permitir drag si se está editando o viendo video
      if (this.isEditing || this.isWatchingVideo) {
        return true;
      }

      if (this.selectedSong) {
        e.preventDefault();
        return false;
      }
      return true;
    });

    // Detectar cambio de ventana (posible captura de pantalla)
    document.addEventListener('visibilitychange', () => {
      if (this.selectedSong && document.hidden && !this.isEditing && !this.isWatchingVideo) {
        // Usuario cambió de ventana, posible captura
      }
    });
  }

  private showProtectionWarning() {
    Swal.fire({
      title: '🔒 Contenido Protegido',
      text: 'Este contenido está protegido. No se permite copiar, capturar o guardar.',
      icon: 'warning',
      confirmButtonColor: '#189d98',
      confirmButtonText: 'Entendido',
      allowOutsideClick: false
    });
  }

  shouldShowStatus(status: string | null | undefined): boolean {
    if (!status) return false;
    return status.trim().toLowerCase() !== 'repertorio';
  }

  extractCategories() {
    const uniqueCategories = [...new Set(this.songs.map(song => song.category))];
    this.categories = uniqueCategories.filter(category => category); // Filtrar valores vacíos
  }

  toggleCategoryForIndex(category: string) {
    const idx = this.selectedCategoriesForIndex.indexOf(category);
    if (idx >= 0) {
      this.selectedCategoriesForIndex.splice(idx, 1);
    } else {
      this.selectedCategoriesForIndex.push(category);
    }
  }

  selectAllCategoriesForIndex() {
    this.selectedCategoriesForIndex = [];
  }

  getCategorySongCount(category: string): number {
    return this.songsByCategory[category]?.length || 0;
  }

  get sortedIndexSongs(): any[] {
    let result = [...this.songs];

    // Filtrar únicamente por los chips de categorías seleccionados en el Índice General
    if (this.selectedCategoriesForIndex.length > 0) {
      result = result.filter(s => this.selectedCategoriesForIndex.includes(s.category));
    }

    // Filtrar por término de búsqueda si hay uno
    if (this.searchTerm && this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      result = result.filter(song =>
        (song.title && song.title.toLowerCase().includes(term)) ||
        (song.generalOrderNumber !== undefined && song.generalOrderNumber !== null && (
          song.generalOrderNumber.toString() === term ||
          song.generalOrderNumber.toString().includes(term) ||
          ('#' + song.generalOrderNumber).includes(term)
        )) ||
        (song.orderNumber !== undefined && song.orderNumber !== null && (
          song.orderNumber.toString() === term ||
          song.orderNumber.toString().includes(term) ||
          ('#' + song.orderNumber).includes(term)
        )) ||
        (song.category && song.category.toLowerCase().includes(term)) ||
        (song.composers && song.composers.toLowerCase().includes(term)) ||
        (song.status && song.status.toLowerCase().includes(term)) ||
        (song.structure && song.structure.toLowerCase().includes(term))
      );
    }

    // Ordenar según criterio del Índice General
    result.sort((a, b) => {
      let comparison = 0;
      if (this.indexSortBy === 'number') {
        comparison = this.compareByGeneralIndex(a, b);
      } else if (this.indexSortBy === 'title') {
        comparison = (a.title || '').localeCompare(b.title || '');
      } else if (this.indexSortBy === 'category') {
        comparison = (a.category || '').localeCompare(b.category || '');
        if (comparison === 0) {
          const numA = a.orderNumber != null && !isNaN(Number(a.orderNumber)) ? Number(a.orderNumber) : 999999;
          const numB = b.orderNumber != null && !isNaN(Number(b.orderNumber)) ? Number(b.orderNumber) : 999999;
          comparison = numA - numB;
          if (comparison === 0) {
            comparison = (a.title || '').localeCompare(b.title || '');
          }
        }
      }

      return this.sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }

  private compareByGeneralIndex(a: any, b: any): number {
    const hasGenA = a.generalOrderNumber != null && !isNaN(Number(a.generalOrderNumber));
    const hasGenB = b.generalOrderNumber != null && !isNaN(Number(b.generalOrderNumber));
    if (hasGenA && hasGenB) {
      const diff = Number(a.generalOrderNumber) - Number(b.generalOrderNumber);
      if (diff !== 0) return diff;
    } else if (hasGenA && !hasGenB) {
      return -1;
    } else if (!hasGenA && hasGenB) {
      return 1;
    }

    // Si aún no tienen generalOrderNumber asignado, ordenar de forma estable por categoría -> número de carpeta -> título
    const catCmp = (a.category || '').localeCompare(b.category || '');
    if (catCmp !== 0) return catCmp;
    const hasOrdA = a.orderNumber != null && !isNaN(Number(a.orderNumber));
    const hasOrdB = b.orderNumber != null && !isNaN(Number(b.orderNumber));
    if (hasOrdA && hasOrdB) {
      const ordDiff = Number(a.orderNumber) - Number(b.orderNumber);
      if (ordDiff !== 0) return ordDiff;
    } else if (hasOrdA && !hasOrdB) {
      return -1;
    } else if (!hasOrdA && hasOrdB) {
      return 1;
    }
    return (a.title || '').localeCompare(b.title || '');
  }

  get fullyLearnedSongsCount(): number {
    if (this.activeUsers.length === 0) return 0;
    return this.songs.filter(s => this.getLearnedPercentage(s) === 100).length;
  }

  get inProgressSongsCount(): number {
    if (this.activeUsers.length === 0) return 0;
    return this.songs.filter(s => {
      const p = this.getLearnedPercentage(s);
      return p > 0 && p < 100;
    }).length;
  }

  get notStartedSongsCount(): number {
    if (this.activeUsers.length === 0) return 0;
    return this.songs.filter(s => this.getLearnedPercentage(s) === 0).length;
  }

  get learningTabSongs(): any[] {
    let result = [...this.songs];
    if (this.selectedCategory) {
      result = result.filter(s => s.category === this.selectedCategory);
    }
    if (this.searchTerm && this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      result = result.filter(s =>
        (s.title && s.title.toLowerCase().includes(term)) ||
        (s.category && s.category.toLowerCase().includes(term)) ||
        (s.generalOrderNumber !== undefined && s.generalOrderNumber !== null && s.generalOrderNumber.toString().includes(term)) ||
        (s.orderNumber !== undefined && s.orderNumber !== null && s.orderNumber.toString().includes(term))
      );
    }
    result.sort((a, b) => this.compareByGeneralIndex(a, b));
    return result;
  }

  setSort(criterion: 'number' | 'title' | 'category') {
    if (this.indexSortBy === criterion) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.indexSortBy = criterion;
      this.sortDirection = 'asc';
    }
  }

  async autoAssignOrderNumbers() {
    if (!this.isAdmin && !this.canEditSongs) return;

    const currentList = [...this.sortedIndexSongs];
    if (currentList.length === 0) return;

    const result = await Swal.fire({
      title: '🔢 Renumerar Índice General',
      text: `¿Deseas asignar números correlativos (1 al ${currentList.length}) en el Índice General según el orden mostrado? (El índice interno de cada carpeta no se modificará)`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#189d98',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, renumerar Índice General',
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    Swal.fire({
      title: 'Renumerando Índice General...',
      text: 'Por favor espera',
      allowOutsideClick: false,
      didOpen: () => { Swal.showLoading(); }
    });

    try {
      const updates: { id: string; generalOrderNumber: number }[] = [];
      for (let i = 0; i < currentList.length; i++) {
        const song = currentList[i];
        const newOrder = i + 1;
        updates.push({ id: song.id, generalOrderNumber: newOrder });
        song.generalOrderNumber = newOrder;
        const mainIndex = this.songs.findIndex(s => s.id === song.id);
        if (mainIndex !== -1) {
          this.songs[mainIndex].generalOrderNumber = newOrder;
        }
      }
      this.indexSortBy = 'number';
      this.sortDirection = 'asc';
      await this.songbookService.batchUpdateOrderNumbers(updates);
      Swal.fire('¡Listo!', `Se asignó el Índice General (1 al ${currentList.length}) con éxito.`, 'success');
    } catch (error) {
      Swal.fire('Error', 'No se pudo renumerar el Índice General: ' + error, 'error');
    }
  }

  async autoAssignCategoryOrderNumbers(category: string, event?: Event) {
    if (event) event.stopPropagation();
    if (!this.isAdmin && !this.canEditSongs) return;

    const folderSongs = [...(this.songsByCategory[category] || [])];
    if (folderSongs.length === 0) return;

    const result = await Swal.fire({
      title: `📁 Renumerar carpeta "${category}"`,
      text: `¿Deseas asignar números internos correlativos (1 al ${folderSongs.length}) a las canciones de "${category}"? (El Índice General no se verá afectado)`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#189d98',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, renumerar carpeta',
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    try {
      this.isReorderingSongs = true;
      const updates: { id: string; orderNumber: number }[] = [];
      for (let i = 0; i < folderSongs.length; i++) {
        const song = folderSongs[i];
        const newOrder = i + 1;
        updates.push({ id: song.id, orderNumber: newOrder });
        song.orderNumber = newOrder;
        const mainIndex = this.songs.findIndex(s => s.id === song.id);
        if (mainIndex !== -1) {
          this.songs[mainIndex].orderNumber = newOrder;
        }
      }
      this.organizeSongsByCategory();
      await this.songbookService.batchUpdateOrderNumbers(updates);
      Swal.fire({
        toast: true,
        position: 'bottom-end',
        icon: 'success',
        title: `Carpeta "${category}" renumerada`,
        text: `Numeración interna actualizada del #1 al #${folderSongs.length}`,
        showConfirmButton: false,
        timer: 2500
      });
    } catch (error) {
      Swal.fire('Error', 'No se pudo renumerar la carpeta: ' + error, 'error');
    } finally {
      this.isReorderingSongs = false;
    }
  }

  onSongDragStart(event: DragEvent, song: any, context: 'general' | 'category' = 'general', categoryName?: string) {
    if (!this.isAdmin || this.isReorderingSongs || !song?.id) {
      event.preventDefault();
      return;
    }
    this.draggedSong = song;
    this.dragContext = context;
    this.dragCategoryName = categoryName || null;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', song.id);
    }
  }

  onSongDragOver(event: DragEvent, targetSong: any, context: 'general' | 'category' = 'general', categoryName?: string) {
    if (!this.isAdmin || !this.draggedSong || !targetSong?.id || this.draggedSong.id === targetSong.id) {
      return;
    }
    if (this.dragContext !== context) return;
    if (context === 'category' && this.dragCategoryName !== (categoryName || null)) return;

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    const currentTarget = event.currentTarget as HTMLElement;
    if (currentTarget) {
      const rect = currentTarget.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      this.dragDropPosition = event.clientY < midpoint ? 'before' : 'after';
    }
    this.dragOverSongId = targetSong.id;
  }

  onSongDragLeave(event: DragEvent, targetSong: any) {
    if (this.dragOverSongId === targetSong?.id) {
      const currentTarget = event.currentTarget as HTMLElement;
      const relatedTarget = event.relatedTarget as Node | null;
      if (!currentTarget || !relatedTarget || !currentTarget.contains(relatedTarget)) {
        this.dragOverSongId = null;
      }
    }
  }

  onSongDragEnd() {
    this.draggedSong = null;
    this.dragOverSongId = null;
    this.dragCategoryName = null;
  }

  async onSongDrop(event: DragEvent, targetSong: any, context: 'general' | 'category' = 'general', categoryName?: string) {
    event.preventDefault();
    event.stopPropagation();

    const sourceSong = this.draggedSong;
    const dropPos = this.dragDropPosition;
    const sourceContext = this.dragContext;
    const sourceCat = this.dragCategoryName;
    this.draggedSong = null;
    this.dragOverSongId = null;
    this.dragCategoryName = null;

    if (!this.isAdmin || !sourceSong || !targetSong || sourceSong.id === targetSong.id || this.isReorderingSongs) {
      return;
    }
    if (sourceContext !== context) return;

    if (context === 'category') {
      const cat = categoryName || sourceCat || targetSong.category;
      if (!cat) return;
      await this.reorderCategoryFolderSong(sourceSong, targetSong, dropPos, cat);
    } else {
      await this.reorderGeneralIndexSong(sourceSong, targetSong, dropPos);
    }
  }

  async moveSongStep(
    event: Event,
    song: any,
    direction: 'up' | 'down',
    currentList: any[],
    context: 'general' | 'category' = 'general',
    categoryName?: string
  ) {
    event.stopPropagation();
    if (!this.isAdmin || this.isReorderingSongs || !song?.id || !currentList?.length) return;

    const currentIndex = currentList.findIndex(s => s.id === song.id);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= currentList.length) return;

    const targetSong = currentList[targetIndex];
    const dropPos = direction === 'up' ? 'before' : 'after';

    if (context === 'category') {
      const cat = categoryName || song.category;
      if (!cat) return;
      await this.reorderCategoryFolderSong(song, targetSong, dropPos, cat);
    } else {
      await this.reorderGeneralIndexSong(song, targetSong, dropPos);
    }
  }

  /**
   * Reordena y actualiza exclusivamente el Índice General (generalOrderNumber),
   * conservando intacto el índice interno (orderNumber) de cada carpeta.
   */
  private async reorderGeneralIndexSong(sourceSong: any, targetSong: any, position: 'before' | 'after') {
    if (!this.isAdmin || this.isReorderingSongs) return;

    const isUnfilteredIndex = !this.searchTerm?.trim() && this.selectedCategoriesForIndex.length === 0;
    const baseList = isUnfilteredIndex
      ? [...this.sortedIndexSongs]
      : [...this.songs].sort((a, b) => this.compareByGeneralIndex(a, b));

    const fromIndex = baseList.findIndex(s => s.id === sourceSong.id);
    if (fromIndex === -1) return;

    const [movedItem] = baseList.splice(fromIndex, 1);
    const targetIndex = baseList.findIndex(s => s.id === targetSong.id);
    if (targetIndex === -1) return;

    const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
    baseList.splice(insertIndex, 0, movedItem);

    this.indexSortBy = 'number';
    this.sortDirection = 'asc';

    const updates: { id: string; generalOrderNumber: number }[] = [];
    let newMovedGeneralNumber = insertIndex + 1;

    for (let i = 0; i < baseList.length; i++) {
      const item = baseList[i];
      const newOrder = i + 1;
      if (item.id === movedItem.id) {
        newMovedGeneralNumber = newOrder;
      }
      if (Number(item.generalOrderNumber) !== newOrder) {
        updates.push({ id: item.id, generalOrderNumber: newOrder });
      }
      item.generalOrderNumber = newOrder;
      const mainIdx = this.songs.findIndex(s => s.id === item.id);
      if (mainIdx !== -1) {
        this.songs[mainIdx].generalOrderNumber = newOrder;
      }
    }

    if (updates.length === 0) return;

    this.isReorderingSongs = true;
    try {
      await this.songbookService.batchUpdateOrderNumbers(updates);
      Swal.fire({
        toast: true,
        position: 'bottom-end',
        icon: 'success',
        title: 'Índice General actualizado',
        text: `"${movedItem.title}" ahora es #${newMovedGeneralNumber} en el Índice General`,
        showConfirmButton: false,
        timer: 2200,
        timerProgressBar: true
      });
    } catch (error) {
      console.error('Error al actualizar el Índice General:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error al guardar el Índice General',
        text: 'No se pudo actualizar la numeración: ' + error
      });
    } finally {
      this.isReorderingSongs = false;
    }
  }

  /**
   * Reordena y actualiza exclusivamente el índice interno (orderNumber) dentro de una carpeta/categoría,
   * sin afectar el Índice General ni las demás carpetas.
   */
  private async reorderCategoryFolderSong(
    sourceSong: any,
    targetSong: any,
    position: 'before' | 'after',
    category: string
  ) {
    if (!this.isAdmin || this.isReorderingSongs || !category) return;

    const folderList = [...(this.songsByCategory[category] || [])];
    const fromIndex = folderList.findIndex(s => s.id === sourceSong.id);
    if (fromIndex === -1) return;

    const [movedItem] = folderList.splice(fromIndex, 1);
    const targetIndex = folderList.findIndex(s => s.id === targetSong.id);
    if (targetIndex === -1) return;

    const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
    folderList.splice(insertIndex, 0, movedItem);

    const updates: { id: string; orderNumber: number }[] = [];
    let newMovedFolderNumber = insertIndex + 1;

    for (let i = 0; i < folderList.length; i++) {
      const item = folderList[i];
      const newOrder = i + 1;
      if (item.id === movedItem.id) {
        newMovedFolderNumber = newOrder;
      }
      if (Number(item.orderNumber) !== newOrder) {
        updates.push({ id: item.id, orderNumber: newOrder });
      }
      item.orderNumber = newOrder;
      const mainIdx = this.songs.findIndex(s => s.id === item.id);
      if (mainIdx !== -1) {
        this.songs[mainIdx].orderNumber = newOrder;
      }
    }

    this.organizeSongsByCategory();

    if (updates.length === 0) return;

    this.isReorderingSongs = true;
    try {
      await this.songbookService.batchUpdateOrderNumbers(updates);
      Swal.fire({
        toast: true,
        position: 'bottom-end',
        icon: 'success',
        title: `Orden en "${category}" actualizado`,
        text: `"${movedItem.title}" ahora es #${newMovedFolderNumber} en su carpeta`,
        showConfirmButton: false,
        timer: 2200,
        timerProgressBar: true
      });
    } catch (error) {
      console.error('Error al actualizar el orden de la carpeta:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error al guardar orden de carpeta',
        text: 'No se pudo actualizar la numeración interna: ' + error
      });
    } finally {
      this.isReorderingSongs = false;
    }
  }

  filterSongs() {
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      // Buscar en todas las canciones sin importar la categoría
      this.filteredSongs = this.songs.filter(song =>
        (song.title && song.title.toLowerCase().includes(term)) ||
        (song.generalOrderNumber !== undefined && song.generalOrderNumber !== null && (
          song.generalOrderNumber.toString() === term ||
          song.generalOrderNumber.toString().includes(term) ||
          ('#' + song.generalOrderNumber).includes(term)
        )) ||
        (song.orderNumber !== undefined && song.orderNumber !== null && (
          song.orderNumber.toString() === term ||
          song.orderNumber.toString().includes(term) ||
          ('#' + song.orderNumber).includes(term)
        )) ||
        (song.category && song.category.toLowerCase().includes(term)) ||
        (song.composers && song.composers.toLowerCase().includes(term)) ||
        (song.status && song.status.toLowerCase().includes(term)) ||
        (song.structure && song.structure.toLowerCase().includes(term))
      );
    } else {
      // Si no hay búsqueda, mostrar las canciones según la categoría seleccionada
      if (this.selectedCategory) {
        this.filteredSongs = this.songsByCategory[this.selectedCategory] || [];
      } else {
        this.filteredSongs = [];
      }
    }
  }

  openSongDetail(song: any, tab: 'lyrics' | 'learning' = 'lyrics') {
    this.selectedSong = song;
    this.modalActiveTab = tab;
    this.isModalOpen = true;
    this.editedOrderNumber = song.orderNumber != null && !isNaN(Number(song.orderNumber)) ? Number(song.orderNumber) : null;
    this.editedGeneralOrderNumber = song.generalOrderNumber != null && !isNaN(Number(song.generalOrderNumber)) ? Number(song.generalOrderNumber) : null;
    this.editedStructure = song.structure || '';
    this.editedInstrumentation = song.instrumentation || '';
    this.editedTitle = song.title || '';
    this.editedCategory = song.category || '';
    this.editedStatus = song.status || '';
    this.editedComposers = song.composers || '';
    this.editedYoutubeLink = song.youtubeLink || '';
    this.editedExcludeFromLearning = !!song.excludeFromLearning;
    this.isEditing = false;
    document.body.style.overflow = 'auto';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Reset contadores de protección móvil
    this.screenshotAttempts = 0;
    this.powerButtonPresses = 0;
    this.volumeDownPresses = 0;
  }

  closeSongDetail() {
    this.selectedSong = null;
    this.modalActiveTab = 'lyrics';
    this.isModalOpen = false;
    this.isEditing = false;
    this.editedOrderNumber = null;
    this.editedGeneralOrderNumber = null;
    this.editedStructure = '';
    this.editedInstrumentation = '';
    this.editedTitle = '';
    this.editedCategory = '';
    this.editedStatus = '';
    this.editedComposers = '';
    this.editedYoutubeLink = '';
    this.editedExcludeFromLearning = false;
    this.isWatchingVideo = false;
    this.isVideoFloating = false;

    document.body.style.overflow = 'auto'; // Restaurar scroll
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Reset contadores de protección móvil
    this.screenshotAttempts = 0;
    this.powerButtonPresses = 0;
    this.volumeDownPresses = 0;
  }

  startEditing() {
    this.isEditing = true;
    this.editedOrderNumber = this.selectedSong?.orderNumber != null && !isNaN(Number(this.selectedSong.orderNumber)) ? Number(this.selectedSong.orderNumber) : null;
    this.editedGeneralOrderNumber = this.selectedSong?.generalOrderNumber != null && !isNaN(Number(this.selectedSong.generalOrderNumber)) ? Number(this.selectedSong.generalOrderNumber) : null;
    this.editedStructure = this.selectedSong.structure || '';
    this.editedInstrumentation = this.selectedSong.instrumentation || '';
    this.editedTitle = this.selectedSong.title || '';
    this.editedCategory = this.selectedSong.category || '';
    this.editedStatus = this.selectedSong.status || '';
    this.editedComposers = this.selectedSong.composers || '';
    this.editedYoutubeLink = this.selectedSong.youtubeLink || '';
    this.editedExcludeFromLearning = !!this.selectedSong?.excludeFromLearning;
  }

  async cancelEditing() {
    // Verificar si hay cambios sin guardar
    const hasChanges =
      this.editedOrderNumber !== (this.selectedSong.orderNumber ?? null) ||
      this.editedGeneralOrderNumber !== (this.selectedSong.generalOrderNumber ?? null) ||
      this.editedStructure !== (this.selectedSong.structure || '') ||
      this.editedInstrumentation !== (this.selectedSong.instrumentation || '') ||
      this.editedTitle !== (this.selectedSong.title || '') ||
      this.editedCategory !== (this.selectedSong.category || '') ||
      this.editedStatus !== (this.selectedSong.status || '') ||
      this.editedComposers !== (this.selectedSong.composers || '') ||
      this.editedYoutubeLink !== (this.selectedSong.youtubeLink || '') ||
      this.editedExcludeFromLearning !== (!!this.selectedSong.excludeFromLearning);

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
    this.editedOrderNumber = this.selectedSong?.orderNumber ?? null;
    this.editedGeneralOrderNumber = this.selectedSong?.generalOrderNumber ?? null;
    this.editedStructure = this.selectedSong.structure || '';
    this.editedInstrumentation = this.selectedSong.instrumentation || '';
    this.editedExcludeFromLearning = !!this.selectedSong?.excludeFromLearning;
  }

  async saveChanges() {
    if (!this.selectedSong || this.isSaving) return;

    // Mostrar confirmación antes de guardar
    const result = await Swal.fire({
      title: '¿Guardar cambios?',
      text: `Se actualizarán todos los campos de "${this.selectedSong.title}"`,
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
      const parsedOrder = this.editedOrderNumber !== null && this.editedOrderNumber !== undefined && (this.editedOrderNumber as any) !== ''
        ? Number(this.editedOrderNumber)
        : null;
      const parsedGeneralOrder = this.editedGeneralOrderNumber !== null && this.editedGeneralOrderNumber !== undefined && (this.editedGeneralOrderNumber as any) !== ''
        ? Number(this.editedGeneralOrderNumber)
        : null;

      const updatedData: any = {
        title: this.editedTitle,
        orderNumber: parsedOrder,
        generalOrderNumber: parsedGeneralOrder,
        category: this.editedCategory,
        status: this.editedStatus,
        composers: this.editedComposers,
        youtubeLink: this.editedYoutubeLink,
        structure: this.editedStructure,
        instrumentation: this.editedInstrumentation,
        excludeFromLearning: !!this.editedExcludeFromLearning
      };

      await this.songbookService.updateSong(this.selectedSong.id, updatedData);

      // Actualizar la canción en la lista local
      this.selectedSong.title = this.editedTitle;
      this.selectedSong.orderNumber = parsedOrder;
      this.selectedSong.generalOrderNumber = parsedGeneralOrder;
      this.selectedSong.category = this.editedCategory;
      this.selectedSong.status = this.editedStatus;
      this.selectedSong.composers = this.editedComposers;
      this.selectedSong.youtubeLink = this.editedYoutubeLink;
      this.selectedSong.structure = this.editedStructure;
      this.selectedSong.instrumentation = this.editedInstrumentation;
      this.selectedSong.excludeFromLearning = !!this.editedExcludeFromLearning;

      // Actualizar también en la lista principal
      const songIndex = this.songs.findIndex(s => s.id === this.selectedSong.id);
      if (songIndex !== -1) {
        this.songs[songIndex] = { ...this.songs[songIndex], ...updatedData };
      }
      this.organizeSongsByCategory();

      this.isEditing = false;

      Swal.fire({
        title: '¡Éxito!',
        text: 'Los cambios han sido guardados exitosamente',
        icon: 'success',
        confirmButtonColor: '#189d98',
        confirmButtonText: 'Genial'
      });
    } catch (error) {
      console.error('Error al guardar cambios:', error);
      Swal.fire({
        title: 'Error',
        text: 'Hubo un problema al guardar los cambios: ' + error,
        icon: 'error',
        confirmButtonColor: '#dc3545',
        confirmButtonText: 'Entendido'
      });
    } finally {
      this.isSaving = false;
    }
  }

  async toggleExcludeFromLearning(song: any) {
    if (!this.isAdmin && !this.canEditSongs) return;
    if (!song || !song.id) return;

    const newValue = !song.excludeFromLearning;
    const actionText = newValue
      ? 'excluir esta canción del porcentaje de aprendizaje'
      : 'incluir nuevamente esta canción en el porcentaje de aprendizaje';

    const result = await Swal.fire({
      title: newValue ? '🚫 Excluir de aprendizaje' : '✅ Incluir en aprendizaje',
      text: `¿Deseas ${actionText}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#189d98',
      cancelButtonColor: '#718096',
      confirmButtonText: newValue ? 'Sí, excluir' : 'Sí, incluir',
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    try {
      await this.songbookService.updateSong(song.id, { excludeFromLearning: newValue });
      song.excludeFromLearning = newValue;
      const songIndex = this.songs.findIndex(s => s.id === song.id);
      if (songIndex !== -1) {
        this.songs[songIndex].excludeFromLearning = newValue;
      }
      this.editedExcludeFromLearning = newValue;

      Swal.fire({
        icon: 'success',
        title: newValue ? 'Excluida del cálculo' : 'Incluida en el cálculo',
        text: newValue
          ? 'Esta canción ya no contará en los porcentajes ni totales de aprendizaje.'
          : 'Esta canción ahora sí contará en los porcentajes de aprendizaje.',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
      });
    } catch (error) {
      console.error('Error al actualizar exclusión de aprendizaje:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo guardar la preferencia: ' + error
      });
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

  // Protección específica para móviles
  private enableMobileScreenshotProtection() {
    // Detectar combinación de teclas de volumen + power
    this.addMobileKeyListeners();

    // Detectar gestos de captura de pantalla
    this.addMobileTouchListeners();

    // Protección contra app switching (Android)
    this.addAppSwitchProtection();

    // Detectar orientation change (posible captura)
    this.addOrientationProtection();
  }

  private addMobileKeyListeners() {
    // Detectar Volume Down + Power (Android screenshot)
    document.addEventListener('keydown', (e) => {
      if (this.selectedSong) {
        // Detectar teclas de volumen y power
        if (e.code === 'VolumeDown' || e.key === 'VolumeDown') {
          this.volumeDownPresses++;
          this.checkScreenshotCombo();
        }

        if (e.code === 'Power' || e.key === 'Power') {
          this.powerButtonPresses++;
          this.checkScreenshotCombo();
        }

        // Reset después de 2 segundos
        setTimeout(() => {
          this.volumeDownPresses = 0;
          this.powerButtonPresses = 0;
        }, 2000);
      }
    });
  }

  private addMobileTouchListeners() {
    // Detectar gestos de captura (3 dedos hacia abajo en iOS)
    document.addEventListener('touchstart', (e) => {
      if (this.selectedSong) {
        this.touchCount = e.touches.length;
        this.touchStartTime = Date.now();

        // Detectar 3 o más dedos (iOS screenshot gesture)
        if (this.touchCount >= 3) {
          this.handleSuspiciousActivity('Gesto de captura detectado');
        }
      }
    });

    document.addEventListener('touchend', (e) => {
      if (this.selectedSong) {
        const touchDuration = Date.now() - this.touchStartTime;

        // Detectar tap rápido con múltiples dedos
        if (this.touchCount >= 2 && touchDuration < 500) {
          this.screenshotAttempts++;
          if (this.screenshotAttempts > 2) {
            this.handleSuspiciousActivity('Múltiples intentos de captura detectados');
          }
        }
      }
    });
  }

  private addAppSwitchProtection() {
    // Detectar cuando la app pierde foco (posible screenshot)
    document.addEventListener('visibilitychange', () => {
      if (this.selectedSong && document.hidden && !this.isEditing && !this.isWatchingVideo) {
        // La app perdió foco, posible captura
        this.handleSuspiciousActivity('Cambio de aplicación detectado');
      }
    });

    // Detectar blur de ventana
    window.addEventListener('blur', () => {
      if (this.selectedSong && !this.isEditing && !this.isWatchingVideo) {
        this.handleSuspiciousActivity('Ventana perdió foco');
      }
    });
  }

  private addOrientationProtection() {
    // Detectar cambios de orientación rápidos (posible captura)
    window.addEventListener('orientationchange', () => {
      if (this.selectedSong && !this.isEditing && !this.isWatchingVideo) {
        this.handleSuspiciousActivity('Cambio de orientación detectado');
      }
    });

    // Detectar resize de ventana (posible screenshot tool)
    window.addEventListener('resize', () => {
      if (this.selectedSong && !this.isEditing && !this.isWatchingVideo) {
        // Detectar cambios bruscos de tamaño
        const currentTime = Date.now();
        if (currentTime - this.lastTouchTime < 1000) {
          this.handleSuspiciousActivity('Redimensionado de ventana detectado');
        }
        this.lastTouchTime = currentTime;
      }
    });
  }

  private checkScreenshotCombo() {
    // Si se presionaron volumen down + power al mismo tiempo
    if (this.volumeDownPresses > 0 && this.powerButtonPresses > 0) {
      this.handleSuspiciousActivity('Combinación de teclas de captura detectada');
    }
  }

  private handleSuspiciousActivity(activity: string) {
    // Si estamos viendo video o editando, ignorar la actividad sospechosa
    if (this.isWatchingVideo || this.isEditing) {
      return;
    }

    // Cerrar el modal inmediatamente
    this.closeSongDetail();

    // Mostrar alerta
    Swal.fire({
      title: '🚨 Actividad Detectada',
      text: `Se detectó: ${activity}. El contenido ha sido protegido.`,
      icon: 'warning',
      confirmButtonColor: '#dc3545',
      confirmButtonText: 'Entendido',
      allowOutsideClick: false,
      timer: 3000
    });

    // Incrementar contador de intentos
    this.screenshotAttempts++;

    // Si hay muchos intentos, bloquear temporalmente
    if (this.screenshotAttempts > 5) {
      this.temporaryBlock();
    }
  }

  private temporaryBlock() {
    Swal.fire({
      title: '🔒 Acceso Temporal Bloqueado',
      text: 'Se han detectado múltiples intentos de captura. Acceso bloqueado por 30 segundos.',
      icon: 'error',
      confirmButtonColor: '#dc3545',
      confirmButtonText: 'Entendido',
      allowOutsideClick: false,
      timer: 30000,
      timerProgressBar: true
    });

    // Reset después de 30 segundos
    setTimeout(() => {
      this.screenshotAttempts = 0;
    }, 30000);
  }

  private removeMobileProtections() {
    // Limpiar todos los event listeners agregados
    // (Los listeners se limpian automáticamente al destruir el componente)
  }

  // Métodos para manejar interacción con videos
  onVideoInteractionStart(event?: Event) {
    // Detener inmediatamente cualquier propagación de eventos
    if (event) {
      event.stopPropagation();
      event.stopImmediatePropagation();
    }

    // Activar inmediatamente el estado de visualización de video
    this.isWatchingVideo = true;
  }

  onVideoInteractionEnd() {
    // Esperar un momento antes de reactivar protecciones para permitir interacciones fluidas
    setTimeout(() => {
      this.isWatchingVideo = false;
    }, 3000); // 3 segundos de gracia para permitir interacciones con controles de YouTube
  }

  // Método para activar manualmente el modo video (debugging)
  forceVideoMode(activate: boolean) {
    this.isWatchingVideo = activate;
  }

  // Métodos para video flotante
  toggleVideoFloat(event: Event) {
    event.stopPropagation();
    this.isVideoFloating = !this.isVideoFloating;

    if (this.isVideoFloating) {
      // Activar modo flotante
      this.onVideoInteractionStart(event);
    }
  }

  private addScrollListener() {
    window.addEventListener('scroll', this.handleScroll.bind(this));
  }

  private handleScroll() {
    // Lógica para video flotante
    if (this.isWatchingVideo && this.selectedSong?.youtubeLink) {
      const videoSection = document.querySelector('.video-section') as HTMLElement;
      const modalBody = document.querySelector('.modal-body') as HTMLElement;

      if (videoSection && modalBody) {
        const videoRect = videoSection.getBoundingClientRect();
        const modalRect = modalBody.getBoundingClientRect();

        // Si el video está fuera de la vista y el usuario está viendo video
        if (videoRect.bottom < 0 || videoRect.top > window.innerHeight) {
          if (!this.isVideoFloating) {
            this.isVideoFloating = true;
          }
        } else {
          // Si el video vuelve a estar visible
          if (this.isVideoFloating && videoRect.top >= 0 && videoRect.bottom <= window.innerHeight) {
            this.isVideoFloating = false;
          }
        }
      }
    }
  }

  // Métodos para control de zoom de texto
  zoomIn() {
    if (this.fontSize < this.maxFontSize) {
      this.fontSize += 2;
      console.log('Zoom in - Font size:', this.fontSize);
    }
  }

  zoomOut() {
    if (this.fontSize > this.minFontSize) {
      this.fontSize -= 2;
      console.log('Zoom out - Font size:', this.fontSize);
    }
  }

  resetZoom() {
    this.fontSize = 16;
    console.log('Reset zoom - Font size:', this.fontSize);
  }

  private organizeSongsByCategory() {
    this.songsByCategory = {};
    this.songs.forEach(song => {
      const category = song.category || 'Sin categoría';
      if (!this.songsByCategory[category]) {
        this.songsByCategory[category] = [];
      }
      this.songsByCategory[category].push(song);
    });

    Object.keys(this.songsByCategory).forEach(cat => {
      this.songsByCategory[cat].sort((a, b) => {
        const hasA = a.orderNumber != null && !isNaN(Number(a.orderNumber));
        const hasB = b.orderNumber != null && !isNaN(Number(b.orderNumber));
        if (hasA && hasB) return Number(a.orderNumber) - Number(b.orderNumber);
        if (hasA && !hasB) return -1;
        if (!hasA && hasB) return 1;
        return (a.title || '').localeCompare(b.title || '');
      });
    });
  }

  toggleSongByCategory(category: string) {
    if (this.selectedCategory === category) {
      this.selectedCategory = null;
    } else {
      this.selectedCategory = category;
    }
  }

  // ==========================================
  // MÉTODOS PARA CONTROL DE APRENDIZAJE
  // ==========================================

  loadActiveUsers() {
    this.authService.firestore.collection('users').valueChanges({ idField: 'uid' }).subscribe((allUsers: any[]) => {
      this.activeUsers = allUsers.filter(user =>
        !user.deleted &&
        !user.onLeave &&
        user.name &&
        user.name !== 'Estudiantina Tonantzin Guadalupe' &&
        user.name !== 'estudiantina tonantzin' &&
        user.email !== 'estudiantina@tonantzin.com'
      ).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    });
  }

  isUserLearned(song: any, userId: string): boolean {
    if (!song || !song.learnedUserIds || !Array.isArray(song.learnedUserIds)) {
      return false;
    }
    return song.learnedUserIds.includes(userId);
  }

  getLearnedCount(song: any): number {
    if (!song || !song.learnedUserIds || !Array.isArray(song.learnedUserIds)) {
      return 0;
    }
    if (this.activeUsers.length === 0) return song.learnedUserIds.length;
    const activeUids = new Set(this.activeUsers.map(u => u.uid));
    return song.learnedUserIds.filter((id: string) => activeUids.has(id)).length;
  }

  getPendingCount(song: any): number {
    const total = this.activeUsers.length;
    const learned = this.getLearnedCount(song);
    return Math.max(0, total - learned);
  }

  getLearnedPercentage(song: any): number {
    if (!this.activeUsers || this.activeUsers.length === 0) return 0;
    const count = this.getLearnedCount(song);
    return Math.round((count / this.activeUsers.length) * 100);
  }

  // ==========================================
  // APRENDIZAJE PERSONAL DEL INTEGRANTE (MI PROGRESO)
  // ==========================================

  /** Canciones que sí cuentan para la meta de aprendizaje (excluye las marcadas por el admin) */
  get countableSongs(): any[] {
    if (!this.songs) return [];
    return this.songs.filter(song => !song.excludeFromLearning);
  }

  isSongLearnedByMe(song: any): boolean {
    if (!song || !this.currentUserId || !song.learnedUserIds || !Array.isArray(song.learnedUserIds)) {
      return false;
    }
    return song.learnedUserIds.includes(this.currentUserId);
  }

  get myLearnedSongsCount(): number {
    if (!this.currentUserId) return 0;
    return this.countableSongs.filter(song => this.isSongLearnedByMe(song)).length;
  }

  get myPendingSongsCount(): number {
    return Math.max(0, this.countableSongs.length - this.myLearnedSongsCount);
  }

  get myLearnedPercentage(): number {
    if (!this.countableSongs || this.countableSongs.length === 0) return 0;
    return Math.round((this.myLearnedSongsCount / this.countableSongs.length) * 100);
  }

  getVisibleMembers(song: any): any[] {
    if (!song || !this.activeUsers) return [];
    let list = this.activeUsers;
    if (this.learningFilter === 'learned') {
      list = list.filter(u => this.isUserLearned(song, u.uid));
    } else if (this.learningFilter === 'pending') {
      list = list.filter(u => !this.isUserLearned(song, u.uid));
    }

    if (this.learningSearchTerm && this.learningSearchTerm.trim()) {
      const term = this.learningSearchTerm.toLowerCase().trim();
      list = list.filter(u =>
        (u.name && u.name.toLowerCase().includes(term)) ||
        (u.instrument && u.instrument.toLowerCase().includes(term)) ||
        (u.email && u.email.toLowerCase().includes(term))
      );
    }
    return list;
  }

  getUserInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  }

  async toggleUserLearned(song: any, userId: string, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    if (!song || !song.id) return;

    const currentList: string[] = Array.isArray(song.learnedUserIds) ? [...song.learnedUserIds] : [];
    const idx = currentList.indexOf(userId);

    if (idx >= 0) {
      currentList.splice(idx, 1);
    } else {
      currentList.push(userId);
    }

    // Actualización local inmediata para respuesta instantánea
    song.learnedUserIds = currentList;
    const songIndex = this.songs.findIndex(s => s.id === song.id);
    if (songIndex !== -1) {
      this.songs[songIndex].learnedUserIds = currentList;
    }

    try {
      await this.songbookService.updateSong(song.id, { learnedUserIds: currentList });
    } catch (err) {
      console.error('Error al actualizar estado de aprendizaje:', err);
      // Revertir en caso de error
      if (idx >= 0) {
        currentList.push(userId);
      } else {
        const revertIdx = currentList.indexOf(userId);
        if (revertIdx >= 0) currentList.splice(revertIdx, 1);
      }
      song.learnedUserIds = currentList;
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo guardar el cambio. Intenta nuevamente.',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
      });
    }
  }

  async markAllLearned(song: any) {
    if (!song || !song.id || this.activeUsers.length === 0) return;
    const allUids = this.activeUsers.map(u => u.uid);
    song.learnedUserIds = allUids;
    const songIndex = this.songs.findIndex(s => s.id === song.id);
    if (songIndex !== -1) {
      this.songs[songIndex].learnedUserIds = allUids;
    }
    await this.songbookService.updateSong(song.id, { learnedUserIds: allUids });
    Swal.fire({
      icon: 'success',
      title: '¡Todos marcados!',
      text: 'Se han marcado todos los integrantes activos como que ya se saben la canción.',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 2500
    });
  }

  async unmarkAllLearned(song: any) {
    if (!song || !song.id) return;
    song.learnedUserIds = [];
    const songIndex = this.songs.findIndex(s => s.id === song.id);
    if (songIndex !== -1) {
      this.songs[songIndex].learnedUserIds = [];
    }
    await this.songbookService.updateSong(song.id, { learnedUserIds: [] });
    Swal.fire({
      icon: 'info',
      title: 'Marcas restablecidas',
      text: 'Se desmarcaron todos los integrantes para esta canción.',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 2500
    });
  }
}