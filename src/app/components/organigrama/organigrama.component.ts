import { Component, OnInit } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export interface RankConfig {
  key: string;
  order: number;
  title: string;
  subtitle: string;
  icon: string;
  accentColor: string;
  bgLight: string;
  borderColor: string;
}

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
    key: 'pardillo-discipulo',
    order: 4,
    title: 'Pardillo Discípulo',
    subtitle: 'Integrantes en formación avanzada bajo tutela directa',
    icon: '🎓',
    accentColor: '#6d28d9',
    bgLight: '#f5f3ff',
    borderColor: '#ddd6fe'
  },
  {
    key: 'pardillo-aprendiz',
    order: 5,
    title: 'Pardillo Aprendiz',
    subtitle: 'Integrantes en etapa de aprendizaje musical y escénico',
    icon: '🌱',
    accentColor: '#047857',
    bgLight: '#ecfdf5',
    borderColor: '#a7f3d0'
  },
  {
    key: 'aspirante',
    order: 6,
    title: 'Aspirante',
    subtitle: 'Nuevos ingresos en preparación inicial dentro de la estudiantina',
    icon: '✨',
    accentColor: '#475569',
    bgLight: '#f8fafc',
    borderColor: '#cbd5e1'
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

  constructor(
    private firestore: AngularFirestore,
    private afAuth: AngularFireAuth,
    private router: Router
  ) {}

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

    this.rankGroups = this.ranks
      .filter(r => this.selectedRankFilter === 'all' || this.selectedRankFilter === r.key)
      .map(rank => {
        const membersInRank = enriched
          .filter(m => m.rankKey === rank.key)
          .sort((a, b) => {
            const lvA = a.resolvedLevel ?? 99;
            const lvB = b.resolvedLevel ?? 99;
            if (lvA !== lvB) return lvA - lvB;
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

  /**
   * Descarga el Organigrama Oficial en formato PDF
   */
  exportOrganigramaPDF() {
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const nowStr = new Date().toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      doc.setFillColor(24, 157, 152);
      doc.rect(0, 0, pageWidth, 24, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.text('ESTUDIANTINA TONANTZIN GUADALUPE', pageWidth / 2, 10, { align: 'center' });

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text('ORGANIGRAMA OFICIAL POR RANGOS Y NIVELES', pageWidth / 2, 18, { align: 'center' });

      doc.setTextColor(30, 41, 59);
      doc.setFontSize(9);
      doc.text(`Fecha: ${nowStr}   |   Total Integrantes Activos: ${this.allActiveMembers.length}`, 14, 31);

      const rows: any[] = [];
      this.ranks.forEach(rank => {
        const group = this.allActiveMembers
          .filter(m => m.rank === rank.key)
          .map(m => ({ ...m, resolvedLevel: this.getMemberLevel(m) }))
          .sort((a, b) => (a.resolvedLevel ?? 99) - (b.resolvedLevel ?? 99) || (a.name || '').localeCompare(b.name || ''));

        if (group.length === 0) {
          rows.push([
            `${rank.order}. ${rank.title.toUpperCase()}`,
            '-',
            'Sin integrantes asignados en este rango',
            '-'
          ]);
        } else {
          group.forEach((m, idx) => {
            rows.push([
              idx === 0 ? `${rank.order}. ${rank.title.toUpperCase()} (${group.length})` : '',
              m.resolvedLevel ? `Nivel ${m.resolvedLevel}` : 'Sin nivel',
              m.name + (m.nickname ? ` "${m.nickname}"` : ''),
              m.instrument || 'Sin instrumento'
            ]);
          });
        }
      });

      (doc as any).autoTable({
        startY: 36,
        head: [['Rango Jerárquico', 'Nivel', 'Integrante', 'Instrumento']],
        body: rows,
        theme: 'grid',
        headStyles: {
          fillColor: [24, 157, 152],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 9
        },
        styles: {
          fontSize: 8.5,
          cellPadding: 2.5,
          valign: 'middle'
        },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 52 },
          1: { halign: 'center', cellWidth: 26, fontStyle: 'bold' },
          2: { cellWidth: 68 },
          3: { cellWidth: 36 }
        }
      });

      const dateSuffix = new Date().toISOString().split('T')[0];
      doc.save(`Organigrama_Estudiantina_Tonantzin_${dateSuffix}.pdf`);
    } catch (error) {
      console.error('Error generando PDF del organigrama:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo generar el PDF del organigrama.'
      });
    }
  }
}

