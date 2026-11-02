import { Component, OnInit } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';

export interface RankConfig {
  key: string;
  order: number;
  title: string;
  subtitle: string;
  icon: string;
  accentColor: string;
  bgLight: string;
  borderColor: string;
  supervisedBy?: string;
  supervisesLabel?: string;
}

export interface MesaSubordinate {
  userId: string;
  roleTitle: string;
  description?: string;
}

export interface MesaDirectivaArea {
  id: string;
  order: number;
  title: string;
  subtitle: string;
  icon: string;
  accentColor: string;
  headRoleTitle: string;
  headUserId: string;
  subordinates: MesaSubordinate[];
}

export const DEFAULT_MESA_DIRECTIVA: MesaDirectivaArea[] = [
  {
    id: 'direccion-musical',
    order: 1,
    title: 'Dirección Musical',
    subtitle: 'Dirección artística, repertorio, ensayos y formación musical de la agrupación',
    icon: '🎼',
    accentColor: '#b45309',
    headRoleTitle: 'Director Musical',
    headUserId: '',
    subordinates: []
  },
  {
    id: 'secretaria-general',
    order: 2,
    title: 'Secretaría General',
    subtitle: 'Organización interna, actas, comunicación oficial y seguimiento administrativo',
    icon: '📋',
    accentColor: '#0f6b68',
    headRoleTitle: 'Secretario General',
    headUserId: '',
    subordinates: []
  },
  {
    id: 'direccion-finanzas',
    order: 3,
    title: 'Dirección de Finanzas',
    subtitle: 'Administración financiera, estados de cuenta, cuotas y control de pagos',
    icon: '🏦',
    accentColor: '#1d4ed8',
    headRoleTitle: 'Director de Finanzas',
    headUserId: '',
    subordinates: []
  },
  {
    id: 'direccion-redes-sociales',
    order: 4,
    title: 'Dirección de Redes Sociales',
    subtitle: 'Difusión digital, contenido multimedia e imagen institucional',
    icon: '📱',
    accentColor: '#6d28d9',
    headRoleTitle: 'Director de Redes Sociales',
    headUserId: '',
    subordinates: [
      {
        userId: '',
        roleTitle: 'Coordinador de Redes Sociales',
        description: 'Creación de contenido, publicaciones y cobertura multimedia de eventos'
      }
    ]
  },
  {
    id: 'direccion-eventos',
    order: 5,
    title: 'Dirección de Eventos',
    subtitle: 'Coordinación de presentaciones, contratos, agenda y logística',
    icon: '🎉',
    accentColor: '#be123c',
    headRoleTitle: 'Director de Eventos',
    headUserId: '',
    subordinates: [
      {
        userId: '',
        roleTitle: 'Auxiliar de Eventos',
        description: 'Apoyo logístico, acomodo de transporte y organización en presentaciones'
      }
    ]
  },
  {
    id: 'gestion-insumos',
    order: 6,
    title: 'Gestión de Insumos',
    subtitle: 'Control de almacén, inventario, préstamos y materiales de la agrupación',
    icon: '📦',
    accentColor: '#047857',
    headRoleTitle: 'Encargado de Insumos',
    headUserId: '',
    subordinates: [
      {
        userId: '',
        roleTitle: 'Auxiliar de Insumos',
        description: 'Apoyo en entrega de materiales, revisión de inventario y resguardo'
      }
    ]
  }
];

export const ESTUDIANTINA_RANKS: RankConfig[] = [
  {
    key: 'jefe-de-tuna',
    order: 1,
    title: 'Jefe de Tuna',
    subtitle: 'Dirección general y liderazgo musical de la agrupación',
    icon: '👑',
    accentColor: '#b45309',
    bgLight: '#fffbeb',
    borderColor: '#fcd34d'
  },
  {
    key: 'tuno',
    order: 2,
    title: 'Tuno',
    subtitle: 'Integrantes consagrados de máxima jerarquía y tradición',
    icon: '🎖️',
    accentColor: '#0f6b68',
    bgLight: '#f0fdfa',
    borderColor: '#99f6e4'
  },
  {
    key: 'capa',
    order: 3,
    title: 'Capa',
    subtitle: 'Integrantes portadores de capa con trayectoria consolidada',
    icon: '🧥',
    accentColor: '#1d4ed8',
    bgLight: '#eff6ff',
    borderColor: '#bfdbfe'
  },
  {
    key: 'jefe-aspirantes-pardillos',
    order: 4,
    title: 'Jefe de Aspirantes y Pardillos',
    subtitle: 'Responsable directo de Pardillos Discípulos, Pardillos Aprendices y Aspirantes',
    icon: '🛡️',
    accentColor: '#be123c',
    bgLight: '#fff1f2',
    borderColor: '#fecdd3',
    supervisesLabel: 'Tiene bajo su responsabilidad a: Pardillo Discípulo · Pardillo Aprendiz · Aspirante'
  },
  {
    key: 'pardillo-discipulo',
    order: 5,
    title: 'Pardillo Discípulo',
    subtitle: 'Integrantes en formación avanzada bajo tutela directa',
    icon: '🎓',
    accentColor: '#6d28d9',
    bgLight: '#f5f3ff',
    borderColor: '#ddd6fe',
    supervisedBy: 'Jefe de Aspirantes y Pardillos'
  },
  {
    key: 'pardillo-aprendiz',
    order: 6,
    title: 'Pardillo Aprendiz',
    subtitle: 'Integrantes en etapa de aprendizaje musical y escénico',
    icon: '🌱',
    accentColor: '#047857',
    bgLight: '#ecfdf5',
    borderColor: '#a7f3d0',
    supervisedBy: 'Jefe de Aspirantes y Pardillos'
  },
  {
    key: 'aspirante',
    order: 7,
    title: 'Aspirante',
    subtitle: 'Nuevos ingresos en preparación inicial dentro de la estudiantina',
    icon: '✨',
    accentColor: '#475569',
    bgLight: '#f8fafc',
    borderColor: '#cbd5e1',
    supervisedBy: 'Jefe de Aspirantes y Pardillos'
  }
];

@Component({
  selector: 'app-organigrama',
  templateUrl: './organigrama.component.html',
  styleUrls: ['./organigrama.component.css']
})
export class OrganigramaComponent implements OnInit {
  readonly ranks: RankConfig[] = ESTUDIANTINA_RANKS;

  currentUser: any = null;
  currentUserProfile: any = null;
  isAdmin = false;

  allActiveMembers: any[] = [];
  evaluationsMap = new Map<string, number>();
  rankGroups: {
    rank: RankConfig;
    members: any[];
    levelsGroup: { level: number | null; label: string; members: any[] }[];
  }[] = [];
  unassignedMembers: any[] = [];

  searchTerm = '';
  selectedRankFilter: string = 'all';
  showUnassignedPanel = true;

  // Pestaña activa: por defecto 'mesa' (Mesa Directiva) y en segundo lugar 'organigrama'
  activeTab: 'mesa' | 'organigrama' = 'mesa';

  // Configuración de Mesa Directiva
  mesaDirectivaAreas: MesaDirectivaArea[] = [];
  mesaHasFirestoreDocs = false;
  showMesaConfigModal = false;
  isNewMesaArea = false;
  editingMesaArea: MesaDirectivaArea | null = null;
  newSubordinateUserId = '';
  newSubordinateRoleTitle = '';
  newSubordinateDescription = '';

  readonly areaIcons = ['🎼', '📋', '🏦', '📱', '🎉', '📦', '🏛️', '🎭', '🚌', '🎤', '🎸', '📢', '🤝', '⭐'];
  readonly areaColors = [
    { label: 'Turquesa Tonantzin', value: '#0f6b68' },
    { label: 'Ámbar Dirección', value: '#b45309' },
    { label: 'Azul Institucional', value: '#1d4ed8' },
    { label: 'Violeta', value: '#6d28d9' },
    { label: 'Carmesí Eventos', value: '#be123c' },
    { label: 'Esmeralda', value: '#047857' },
    { label: 'Pizarra', value: '#334155' }
  ];

  selectedProfileMember: any = null;
  selectedProfileRank: RankConfig | null = null;
  selectedProfileCustomRole: string | null = null;

  readonly months = [
    { value: '01', name: 'Enero' },
    { value: '02', name: 'Febrero' },
    { value: '03', name: 'Marzo' },
    { value: '04', name: 'Abril' },
    { value: '05', name: 'Mayo' },
    { value: '06', name: 'Junio' },
    { value: '07', name: 'Julio' },
    { value: '08', name: 'Agosto' },
    { value: '09', name: 'Septiembre' },
    { value: '10', name: 'Octubre' },
    { value: '11', name: 'Noviembre' },
    { value: '12', name: 'Diciembre' }
  ];

  constructor(
    private firestore: AngularFirestore,
    private afAuth: AngularFireAuth,
    private router: Router
  ) { }

  ngOnInit() {
    this.afAuth.authState.subscribe(async (user) => {
      if (!user) {
        this.router.navigate(['/']);
        return;
      }
      this.currentUser = user;
      const userDoc = await this.firestore.collection('users').doc(user.uid).get().toPromise();
      this.currentUserProfile = userDoc?.data() as any;
      this.isAdmin = !!this.currentUserProfile?.profiles?.includes('administrador');

      if (!this.isAdmin) {
        this.router.navigate(['/dashboard']);
        return;
      }

      this.loadEvaluationsAndMembers();
    });
  }

  private isInstitutionalAccount(user: any): boolean {
    const cleanName = (user?.name || '').trim().toLowerCase();
    const cleanEmail = (user?.email || '').trim().toLowerCase();
    return (
      cleanName === 'estudiantina tonantzin guadalupe' ||
      cleanName === 'estudiantina tonantzin' ||
      cleanEmail === 'estudiantina@tonantzin.com'
    );
  }

  loadEvaluationsAndMembers() {
    // Escuchar configuración de la Mesa Directiva
    this.firestore.collection('mesa-directiva').valueChanges({ idField: 'id' }).subscribe((docs: any[]) => {
      if (docs && docs.length > 0) {
        this.mesaHasFirestoreDocs = true;
        this.mesaDirectivaAreas = [...docs]
          .map(d => ({
            id: d.id,
            order: Number(d.order) || 1,
            title: d.title || 'Área',
            subtitle: d.subtitle || '',
            icon: d.icon || '🏛️',
            accentColor: d.accentColor || '#0f6b68',
            headRoleTitle: d.headRoleTitle || 'Director / Encargado',
            headUserId: d.headUserId || '',
            subordinates: Array.isArray(d.subordinates) ? d.subordinates : []
          }))
          .sort((a, b) => a.order - b.order);
      } else {
        this.mesaHasFirestoreDocs = false;
        this.mesaDirectivaAreas = DEFAULT_MESA_DIRECTIVA.map(a => ({
          ...a,
          subordinates: [...a.subordinates]
        }));
      }
    });

    // Escuchar evaluaciones para respaldar el nivel del integrante si no está en su documento
    this.firestore.collection('user-evaluations').valueChanges().subscribe((evals: any[]) => {
      this.evaluationsMap.clear();
      // Ordenar de más antigua a más reciente para que la última sobrescriba
      const sorted = [...(evals || [])].sort((a, b) => {
        const dA = a.evaluatedAt?.toDate ? a.evaluatedAt.toDate().getTime() : 0;
        const dB = b.evaluatedAt?.toDate ? b.evaluatedAt.toDate().getTime() : 0;
        return dA - dB;
      });
      sorted.forEach(ev => {
        if (ev.userId && ev.nivel) {
          this.evaluationsMap.set(ev.userId, Number(ev.nivel));
        }
      });
      this.buildOrganigrama();
    });

    this.firestore.collection('users').valueChanges({ idField: 'uid' }).subscribe((users: any[]) => {
      this.allActiveMembers = (users || []).filter(u =>
        !u.deleted &&
        !u.onLeave &&
        u.name &&
        !this.isInstitutionalAccount(u)
      );
      this.buildOrganigrama();
    });
  }

  getMemberLevel(member: any): number | null {
    if (member.evaluationLevel && !isNaN(Number(member.evaluationLevel))) {
      return Number(member.evaluationLevel);
    }
    if (this.evaluationsMap.has(member.uid)) {
      return this.evaluationsMap.get(member.uid)!;
    }
    return null;
  }

  buildOrganigrama() {
    const term = this.searchTerm.trim().toLowerCase();

    const enriched = this.allActiveMembers
      .map(m => ({
        ...m,
        resolvedLevel: this.getMemberLevel(m),
        rankKey: m.rank || null
      }))
      .filter(m => {
        if (!term) return true;
        return (
          (m.name && m.name.toLowerCase().includes(term)) ||
          (m.nickname && m.nickname.toLowerCase().includes(term)) ||
          (m.instrument && m.instrument.toLowerCase().includes(term))
        );
      });

    this.rankGroups = [...this.ranks]
      .sort((a, b) => a.order - b.order)
      .filter(r => this.selectedRankFilter === 'all' || this.selectedRankFilter === r.key)
      .map(rank => {
        const membersInRank = enriched
          .filter(m => m.rankKey === rank.key)
          .sort((a, b) => {
            const lvA = a.resolvedLevel ?? 99;
            const lvB = b.resolvedLevel ?? 99;
            if (lvA !== lvB) return lvA - lvB; // Nivel 1 es el más alto, seguido de Nivel 2, 3...
            return (a.name || '').localeCompare(b.name || '');
          });

        // Agrupar por Nivel dentro del Rango (Nivel 1 -> Nivel 6 -> Sin nivel)
        const levelsMap = new Map<number | null, any[]>();
        membersInRank.forEach(m => {
          const lv = m.resolvedLevel;
          if (!levelsMap.has(lv)) levelsMap.set(lv, []);
          levelsMap.get(lv)!.push(m);
        });

        const levelsGroup = Array.from(levelsMap.entries())
          .sort((a, b) => (a[0] ?? 99) - (b[0] ?? 99))
          .map(([level, list]) => ({
            level,
            label: level ? `Nivel ${level}` : 'Sin Nivel Evaluado',
            members: list
          }));

        return {
          rank,
          members: membersInRank,
          levelsGroup
        };
      });

    const validRankKeys = new Set(this.ranks.map(r => r.key));
    this.unassignedMembers = enriched
      .filter(m => !m.rankKey || !validRankKeys.has(m.rankKey))
      .sort((a, b) => {
        const lvA = a.resolvedLevel ?? 99;
        const lvB = b.resolvedLevel ?? 99;
        if (lvA !== lvB) return lvA - lvB;
        return (a.name || '').localeCompare(b.name || '');
      });
  }

  get totalAssignedCount(): number {
    const validRankKeys = new Set(this.ranks.map(r => r.key));
    return this.allActiveMembers.filter(m => m.rank && validRankKeys.has(m.rank)).length;
  }

  getRankCount(rankKey: string): number {
    return this.allActiveMembers.filter(m => m.rank === rankKey).length;
  }

  getRankLabel(rankKey: string | null): string {
    const found = this.ranks.find(r => r.key === rankKey);
    return found ? `${found.icon} ${found.title}` : 'Sin rango asignado';
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  getLevelBadgeClass(level: number | null): string {
    if (!level) return 'level-none';
    return `level-${level}`;
  }

  openMemberProfileModal(member: any, rank?: RankConfig, event?: Event, customRole?: string) {
    if (event) event.stopPropagation();
    if (!member) return;
    const resolvedRank = rank || this.ranks.find(r => r.key === member?.rank) || null;
    this.selectedProfileMember = {
      ...member,
      resolvedLevel: this.getMemberLevel(member)
    };
    this.selectedProfileRank = resolvedRank;
    this.selectedProfileCustomRole = customRole || null;
  }

  closeMemberProfileModal() {
    this.selectedProfileMember = null;
    this.selectedProfileRank = null;
    this.selectedProfileCustomRole = null;
  }

  getMemberById(uid: string): any | null {
    if (!uid) return null;
    const found = this.allActiveMembers.find(m => m.uid === uid);
    if (!found) return null;
    return {
      ...found,
      resolvedLevel: this.getMemberLevel(found)
    };
  }

  // =========================================================
  // CONFIGURACIÓN DE MESA DIRECTIVA (SOLO ADMINISTRADOR)
  // =========================================================

  private async ensureDefaultMesaSeeded() {
    if (this.mesaHasFirestoreDocs) return;
    for (const def of DEFAULT_MESA_DIRECTIVA) {
      await this.firestore.collection('mesa-directiva').doc(def.id).set({
        order: def.order,
        title: def.title,
        subtitle: def.subtitle,
        icon: def.icon,
        accentColor: def.accentColor,
        headRoleTitle: def.headRoleTitle,
        headUserId: def.headUserId || '',
        subordinates: def.subordinates || []
      });
    }
    this.mesaHasFirestoreDocs = true;
  }

  openCreateMesaAreaModal() {
    if (!this.isAdmin) return;
    this.isNewMesaArea = true;
    const nextOrder = this.mesaDirectivaAreas.length > 0
      ? Math.max(...this.mesaDirectivaAreas.map(a => a.order)) + 1
      : 1;
    this.editingMesaArea = {
      id: `area-${Date.now()}`,
      order: nextOrder,
      title: '',
      subtitle: '',
      icon: '🏛️',
      accentColor: '#0f6b68',
      headRoleTitle: '',
      headUserId: '',
      subordinates: []
    };
    this.newSubordinateUserId = '';
    this.newSubordinateRoleTitle = '';
    this.showMesaConfigModal = true;
  }

  openEditMesaAreaModal(area: MesaDirectivaArea, event?: Event) {
    if (event) event.stopPropagation();
    if (!this.isAdmin) return;
    this.isNewMesaArea = false;
    this.editingMesaArea = {
      ...area,
      subordinates: (area.subordinates || []).map(s => ({ ...s }))
    };
    this.newSubordinateUserId = '';
    this.newSubordinateRoleTitle = '';
    this.showMesaConfigModal = true;
  }

  closeMesaAreaModal() {
    this.showMesaConfigModal = false;
    this.editingMesaArea = null;
    this.newSubordinateUserId = '';
    this.newSubordinateRoleTitle = '';
    this.newSubordinateDescription = '';
  }

  addSubordinateToForm() {
    if (!this.editingMesaArea) return;
    if (!this.newSubordinateUserId && !this.newSubordinateRoleTitle.trim()) return;
    const roleLabel = this.newSubordinateRoleTitle.trim() || 'Auxiliar / Coordinador';
    const cleanUserId = this.newSubordinateUserId === '__VACANTE__' ? '' : this.newSubordinateUserId;
    this.editingMesaArea.subordinates.push({
      userId: cleanUserId,
      roleTitle: roleLabel,
      description: this.newSubordinateDescription.trim()
    });
    this.newSubordinateUserId = '';
    this.newSubordinateRoleTitle = '';
    this.newSubordinateDescription = '';
  }

  applyForVacantRole(roleTitle: string, areaTitle: string, event?: Event) {
    if (event) event.stopPropagation();
    const applicantName = this.currentUserProfile?.name || this.currentUser?.email || 'un integrante';
    const message = `Hola, soy *${applicantName}* y me gustaría postularme para la vacante de *${roleTitle}* en *${areaTitle}* dentro de la Mesa Directiva de la Estudiantina Tonantzin Guadalupe.`;
    const whatsappUrl = `https://wa.me/527224250172?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  }

  removeSubordinateFromForm(index: number) {
    if (!this.editingMesaArea) return;
    this.editingMesaArea.subordinates.splice(index, 1);
  }

  async saveMesaArea() {
    if (!this.isAdmin || !this.editingMesaArea) return;
    const area = this.editingMesaArea;
    if (!area.title.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Nombre requerido',
        text: 'Escribe el nombre del área o dirección (ej. Dirección de Eventos).',
        confirmButtonColor: '#189d98'
      });
      return;
    }

    try {
      await this.ensureDefaultMesaSeeded();
      await this.firestore.collection('mesa-directiva').doc(area.id).set({
        order: Number(area.order) || 1,
        title: area.title.trim(),
        subtitle: (area.subtitle || '').trim(),
        icon: area.icon || '🏛️',
        accentColor: area.accentColor || '#0f6b68',
        headRoleTitle: (area.headRoleTitle || '').trim() || area.title.trim(),
        headUserId: area.headUserId || '',
        subordinates: area.subordinates || [],
        updatedAt: new Date()
      });

      this.closeMesaAreaModal();
      Swal.fire({
        icon: 'success',
        title: 'Mesa Directiva actualizada',
        text: `Se guardó la configuración de "${area.title}".`,
        timer: 2000,
        showConfirmButton: false
      });
    } catch (err) {
      console.error('Error guardando área de Mesa Directiva:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo guardar el área de la Mesa Directiva.'
      });
    }
  }

  async deleteMesaArea(area: MesaDirectivaArea, event?: Event) {
    if (event) event.stopPropagation();
    if (!this.isAdmin) return;

    const confirm = await Swal.fire({
      icon: 'warning',
      title: `¿Eliminar "${area.title}"?`,
      text: 'Se quitará esta dirección/cargo de la Mesa Directiva.',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626'
    });

    if (confirm.isConfirmed) {
      try {
        await this.ensureDefaultMesaSeeded();
        await this.firestore.collection('mesa-directiva').doc(area.id).delete();
        Swal.fire({
          icon: 'success',
          title: 'Área eliminada',
          timer: 1600,
          showConfirmButton: false
        });
      } catch (err) {
        console.error('Error eliminando área:', err);
      }
    }
  }

  async moveMesaAreaOrder(area: MesaDirectivaArea, direction: 'up' | 'down', event?: Event) {
    if (event) event.stopPropagation();
    if (!this.isAdmin) return;
    await this.ensureDefaultMesaSeeded();

    const idx = this.mesaDirectivaAreas.findIndex(a => a.id === area.id);
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= this.mesaDirectivaAreas.length) return;

    const current = this.mesaDirectivaAreas[idx];
    const target = this.mesaDirectivaAreas[swapIdx];

    await Promise.all([
      this.firestore.collection('mesa-directiva').doc(current.id).update({ order: swapIdx + 1 }),
      this.firestore.collection('mesa-directiva').doc(target.id).update({ order: idx + 1 })
    ]);
  }

  formatMemberBirthday(member: any): string {
    if (!member) return 'No registrado';
    if (member.birthDay && member.birthMonth) {
      const mObj = this.months.find(m => m.value === String(member.birthMonth).padStart(2, '0'));
      const mName = mObj ? mObj.name : member.birthMonth;
      return `${parseInt(member.birthDay, 10)} de ${mName}`;
    }
    if (member.birthday) {
      const parts = String(member.birthday).split('-');
      if (parts.length >= 2) {
        const monthVal = parts.length === 3 ? parts[1] : parts[0];
        const dayVal = parts.length === 3 ? parts[2] : parts[1];
        const mObj = this.months.find(m => m.value === String(monthVal).padStart(2, '0'));
        if (mObj) return `${parseInt(dayVal, 10)} de ${mObj.name}`;
      }
      return String(member.birthday);
    }
    return 'No registrado';
  }

  getMemberProfileRolesLabel(member: any): string[] {
    const roleNames: { [key: string]: string } = {
      'integrante': '🎵 Integrante',
      'administrador': '⚙️ Administrador',
      'finanzas': '🏦 Finanzas',
      'asistencia': '📋 Asistencia',
      'agenda': '📅 Agenda de Eventos',
      'transporte': '🚌 Transporte',
      'editor-canciones': '📖 Editor de Cancionero',
      'documentador': '📄 Control de Documentos',
      'insumos': '📦 Gestión de Almacén'
    };
    const profiles: string[] = Array.isArray(member?.profiles) && member.profiles.length > 0
      ? member.profiles
      : ['integrante'];
    return profiles.map(p => roleNames[p] || p);
  }

  /**
   * Permite al Administrador asignar o cambiar el Rango (y opcionalmente el Nivel) de un integrante
   */
  async openAssignRankModal(member: any, event?: Event) {
    if (event) event.stopPropagation();
    if (!this.isAdmin) return;

    const currentRank = member.rank || '';
    const currentLevel = this.getMemberLevel(member) || '';

    const rankOptionsHtml = this.ranks
      .map(r => `<option value="${r.key}" ${currentRank === r.key ? 'selected' : ''}>${r.icon} ${r.title}</option>`)
      .join('');

    const levelOptionsHtml = [1, 2, 3, 4, 5, 6]
      .map(lv => `<option value="${lv}" ${Number(currentLevel) === lv ? 'selected' : ''}>🏆 Nivel ${lv}</option>`)
      .join('');

    const { value: formValues } = await Swal.fire({
      title: `Rango y Nivel de ${member.name}`,
      html: `
        <div style="text-align:left; display:flex; flex-direction:column; gap:12px; margin-top:8px;">
          <div>
            <label style="display:block; font-size:0.85rem; font-weight:700; color:#334155; margin-bottom:4px;">
              🏛️ Rango en el Organigrama:
            </label>
            <select id="swal-rank-select" class="swal2-input" style="margin:0; width:100%; font-size:0.95rem;">
              <option value="" ${!currentRank ? 'selected' : ''}>-- Sin rango asignado --</option>
              ${rankOptionsHtml}
            </select>
          </div>
          <div>
            <label style="display:block; font-size:0.85rem; font-weight:700; color:#334155; margin-bottom:4px;">
              🏆 Nivel dentro del Rango (1 al 6):
            </label>
            <select id="swal-level-select" class="swal2-input" style="margin:0; width:100%; font-size:0.95rem;">
              <option value="" ${!currentLevel ? 'selected' : ''}>-- Mantener nivel de evaluación --</option>
              ${levelOptionsHtml}
            </select>
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Guardar Rango',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#189d98',
      preConfirm: () => {
        const rankEl = document.getElementById('swal-rank-select') as HTMLSelectElement;
        const levelEl = document.getElementById('swal-level-select') as HTMLSelectElement;
        return {
          rank: rankEl ? rankEl.value : '',
          level: levelEl && levelEl.value ? Number(levelEl.value) : null
        };
      }
    });

    if (formValues !== undefined) {
      try {
        const updatePayload: any = {
          rank: formValues.rank || null,
          rankUpdatedAt: new Date()
        };
        if (formValues.level) {
          updatePayload.evaluationLevel = formValues.level;
        }
        await this.firestore.collection('users').doc(member.uid).update(updatePayload);

        Swal.fire({
          icon: 'success',
          title: 'Organigrama actualizado',
          text: `${member.name} ahora tiene el rango: ${this.getRankLabel(formValues.rank || null)}`,
          timer: 2000,
          showConfirmButton: false
        });
      } catch (err) {
        console.error('Error actualizando rango:', err);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo guardar el rango del integrante.'
        });
      }
    }
  }
}

